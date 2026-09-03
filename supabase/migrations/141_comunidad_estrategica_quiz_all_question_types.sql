-- 141_comunidad_estrategica_quiz_all_question_types.sql
--
-- Extend the player quiz to support every question type the question bank has:
--   single_choice, multiple_choice, true_false  (already supported)
--   matching     (relate left ↔ right)          NEW
--   fill_blank   (type the answers)             NEW
--   open_ended   -> EXCLUDED from quizzes (no auto-grading)
--
-- start_quiz: excludes open_ended, and ships the extra per-type payload the
-- client needs WITHOUT leaking the answer:
--   matching   -> pairs_left (in order) + pairs_right (shuffled, each { key, text }
--                 where key = index in the ORIGINAL pairs array). The correct
--                 match for left i is the right whose key = i. Shuffling the
--                 display order hides the mapping.
--   fill_blank -> blank_count (number of blanks). accepted_answers are NOT sent.
--
-- submit_quiz: grades the new types.
--   matching   -> answer { matches: number[] }; matches[i] is the key the player
--                 assigned to left i. Correct iff matches[i] = i for all i.
--   fill_blank -> answer { blanks: string[] }; each compared (trim + lower,
--                 unaccent-insensitive) against that blank's accepted_answers.
--                 All blanks must match.

-- ── start_quiz ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_quiz(p_tenant text, p_subject_id uuid, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count       INTEGER;
  v_available   INTEGER;
  v_take        INTEGER;
  v_questions   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    (SELECT quiz_question_count FROM game_quiz_subject_settings
      WHERE tenant = p_tenant AND subject_id = p_subject_id),
    (SELECT quiz_question_count FROM game_settings WHERE tenant = p_tenant),
    10
  ) INTO v_count;

  SELECT count(*) INTO v_available
  FROM qb_questions q
  WHERE q.tenant = p_tenant
    AND q.status = 'active'
    AND q.type <> 'open_ended'
    AND q.subject_id = p_subject_id
    AND (p_category_id IS NULL OR q.category_id = p_category_id);

  IF v_available = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  v_take := LEAST(v_count, v_available);

  SELECT jsonb_agg(row_to_json(sub.*))
  INTO v_questions
  FROM (
    SELECT
      q.id,
      q.type,
      q.content,
      -- Choice options: only the text (no is_correct).
      CASE
        WHEN q.type IN ('single_choice', 'multiple_choice') AND jsonb_typeof(q.options) = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('text', elem ->> 'text'))
             FROM jsonb_array_elements(q.options) AS elem),
          '[]'::jsonb
        )
        ELSE '[]'::jsonb
      END AS options,
      -- Matching: left column in order.
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(p ->> 'left' ORDER BY ord)
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_left,
      -- Matching: right column shuffled, each carrying its ORIGINAL index (key).
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('key', ord - 1, 'text', p ->> 'right') ORDER BY random())
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_right,
      -- Fill-blank: how many blanks (no accepted answers).
      CASE
        WHEN q.type = 'fill_blank' AND jsonb_typeof(q.options -> 'blanks') = 'array'
          THEN jsonb_array_length(q.options -> 'blanks')
        ELSE NULL
      END AS blank_count
    FROM qb_questions q
    WHERE q.tenant = p_tenant
      AND q.status = 'active'
      AND q.type <> 'open_ended'
      AND q.subject_id = p_subject_id
      AND (p_category_id IS NULL OR q.category_id = p_category_id)
    ORDER BY random()
    LIMIT v_take
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'subject_id', p_subject_id,
    'category_id', p_category_id,
    'question_count', v_take,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$function$;

-- ── submit_quiz ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_quiz(p_tenant text, p_subject_id uuid, p_category_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid(); v_today DATE := (timezone('America/Santiago', now()))::date;
  v_ans JSONB; v_qid UUID; v_qtype qb_question_type; v_options JSONB;
  v_correct_set INT[]; v_selected_set INT[]; v_tf_correct BOOLEAN; v_is_correct BOOLEAN;
  v_total INTEGER := 0; v_aciertos INTEGER := 0; v_source game_point_sources%ROWTYPE;
  v_base_points INTEGER := 0; v_scoring game_scoring_mode; v_points INTEGER := 0;
  v_event_id UUID; v_counts_streak BOOLEAN := false; v_new_current INTEGER; v_new_longest INTEGER;
  v_completed JSONB := '[]'::jsonb; v_i INTEGER;
  v_pair_count INTEGER; v_match_ok BOOLEAN; v_matches JSONB;
  v_blank_count INTEGER; v_blanks JSONB; v_accepted JSONB; v_given TEXT; v_blank_ok BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED'); END IF;
  IF NOT game_is_accessible(p_tenant) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF player_is_banned(p_tenant, v_user_id) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED'); END IF;
  IF NOT player_has_life(p_tenant, v_user_id) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES'); END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_ANSWERS'); END IF;

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    v_qid := (v_ans ->> 'question_id')::uuid;
    SELECT type, options INTO v_qtype, v_options FROM qb_questions
    WHERE id = v_qid AND tenant = p_tenant AND status = 'active' AND subject_id = p_subject_id
      AND (p_category_id IS NULL OR category_id = p_category_id);
    IF NOT FOUND THEN CONTINUE; END IF;
    v_total := v_total + 1; v_is_correct := false;

    IF v_qtype IN ('single_choice', 'multiple_choice') THEN
      SELECT COALESCE(array_agg(ord ORDER BY ord), '{}') INTO v_correct_set
      FROM (SELECT (idx - 1) AS ord FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
            WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)) c;
      SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}') INTO v_selected_set
      FROM jsonb_array_elements_text(COALESCE(v_ans -> 'selected', '[]'::jsonb)) AS val;
      v_is_correct := (v_selected_set = v_correct_set);

    ELSIF v_qtype = 'true_false' THEN
      v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
      IF (v_ans ? 'value') THEN v_is_correct := ((v_ans ->> 'value')::boolean = v_tf_correct); END IF;

    ELSIF v_qtype = 'matching' THEN
      -- Correct iff, for every left i, the assigned right key equals i.
      IF jsonb_typeof(v_options -> 'pairs') = 'array' THEN
        v_pair_count := jsonb_array_length(v_options -> 'pairs');
        v_matches := v_ans -> 'matches';
        IF jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) = v_pair_count THEN
          v_match_ok := true;
          FOR v_i IN 0 .. v_pair_count - 1 LOOP
            IF COALESCE((v_matches ->> v_i), '')::text <> v_i::text THEN
              v_match_ok := false; EXIT;
            END IF;
          END LOOP;
          v_is_correct := v_match_ok;
        END IF;
      END IF;

    ELSIF v_qtype = 'fill_blank' THEN
      -- Every blank's given text must match one accepted answer (trim + lower).
      IF jsonb_typeof(v_options -> 'blanks') = 'array' THEN
        v_blank_count := jsonb_array_length(v_options -> 'blanks');
        v_blanks := v_ans -> 'blanks';
        IF jsonb_typeof(v_blanks) = 'array' AND jsonb_array_length(v_blanks) = v_blank_count THEN
          v_blank_ok := true;
          FOR v_i IN 0 .. v_blank_count - 1 LOOP
            v_given := lower(btrim(COALESCE(v_blanks ->> v_i, '')));
            v_accepted := (v_options -> 'blanks' -> v_i) -> 'accepted_answers';
            IF v_given = '' OR jsonb_typeof(v_accepted) <> 'array' OR NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v_accepted) AS a
              WHERE lower(btrim(a)) = v_given
            ) THEN
              v_blank_ok := false; EXIT;
            END IF;
          END LOOP;
          v_is_correct := v_blank_ok;
        END IF;
      END IF;
    END IF;

    IF v_is_correct THEN v_aciertos := v_aciertos + 1; END IF;
  END LOOP;

  IF v_total = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS'); END IF;

  SELECT * INTO v_source FROM game_point_sources WHERE tenant = p_tenant AND action_type = 'quiz_completed';
  IF FOUND AND v_source.enabled THEN v_base_points := v_source.points_value; ELSE v_base_points := 0; END IF;
  SELECT COALESCE(scoring_mode, 'fixed') INTO v_scoring FROM game_settings WHERE tenant = p_tenant;
  v_scoring := COALESCE(v_scoring, 'fixed');
  IF v_scoring = 'proportional' THEN v_points := GREATEST(ROUND(v_base_points * v_aciertos::numeric / v_total)::int, 0);
  ELSE v_points := v_base_points; END IF;

  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, subject_id, category_id, occurred_date)
  VALUES (p_tenant, v_user_id, 'quiz_completed', v_points, gen_random_uuid()::text, p_subject_id, p_category_id, v_today)
  RETURNING id INTO v_event_id;

  IF COALESCE(v_source.costs_life, false) AND (v_total - v_aciertos) > 0 THEN
    FOR v_i IN 1..(v_total - v_aciertos) LOOP PERFORM consume_life(p_tenant, v_user_id); END LOOP;
  END IF;

  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);
  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest FROM apply_streak(p_tenant, v_user_id, v_today);
    PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
  END IF;

  v_completed := evaluate_challenges_for_event(v_event_id);
  PERFORM evaluate_badges_for_event(v_event_id);

  RETURN jsonb_build_object('ok', true, 'aciertos', v_aciertos, 'total_presented', v_total,
    'points_awarded', v_points, 'scoring_mode', v_scoring, 'completed_challenges', v_completed);
END;
$function$;
