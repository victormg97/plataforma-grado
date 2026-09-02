-- 139_comunidad_estrategica_daily_review.sql
--
-- Feature: let a player review today's ALREADY-ANSWERED daily question
-- (status, question, their given answer, the correct answer, explanation)
-- for the rest of the day. Requires persisting the answer, which today is not
-- stored anywhere (answer_daily_question only records participation).
--
-- 1) Persist the given answer + correctness on the daily-answer event.
-- 2) Rewire answer_daily_question to write them.
-- 3) New read RPC get_daily_review to reconstruct the review after reload.

-- ── 1. Persist answer + correctness on game_point_events (daily rows) ──────────
-- Nullable columns; only daily_question_answered rows populate them. Existing
-- rows keep NULL (older answers simply have no reviewable detail).
ALTER TABLE game_point_events
  ADD COLUMN IF NOT EXISTS answer jsonb,
  ADD COLUMN IF NOT EXISTS is_correct boolean;

-- ── 2. answer_daily_question: store the answer + correctness ───────────────────
CREATE OR REPLACE FUNCTION answer_daily_question(
  p_tenant TEXT,
  p_answer JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_today          DATE := (timezone('America/Santiago', now()))::date;
  v_question_id    UUID;
  v_qtype          qb_question_type;
  v_options        JSONB;
  v_explanation    TEXT;
  v_is_correct     BOOLEAN := false;
  v_correct_set    INT[];
  v_selected_set   INT[];
  v_tf_correct     BOOLEAN;
  v_tf_value       BOOLEAN;
  v_source         game_point_sources%ROWTYPE;
  v_points         INTEGER := 0;
  v_counts_streak  BOOLEAN := false;
  v_inserted       BIGINT := 0;
  v_profile        game_profiles%ROWTYPE;
  v_new_current    INTEGER;
  v_new_longest    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF player_is_banned(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED');
  END IF;

  IF NOT player_has_life(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES');
  END IF;

  v_question_id := select_daily_question(p_tenant);
  IF v_question_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_DAILY_QUESTION');
  END IF;

  SELECT type, options, explanation
  INTO v_qtype, v_options, v_explanation
  FROM qb_questions
  WHERE id = v_question_id;

  IF v_qtype IN ('single_choice', 'multiple_choice') THEN
    SELECT COALESCE(array_agg(ord ORDER BY ord), '{}')
    INTO v_correct_set
    FROM (
      SELECT (idx - 1) AS ord
      FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
      WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)
    ) c;

    SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}')
    INTO v_selected_set
    FROM jsonb_array_elements_text(COALESCE(p_answer -> 'selected', '[]'::jsonb)) AS val;

    v_is_correct := (v_selected_set = v_correct_set);

  ELSIF v_qtype = 'true_false' THEN
    v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
    IF (p_answer ? 'value') THEN
      v_tf_value := (p_answer ->> 'value')::boolean;
      v_is_correct := (v_tf_value = v_tf_correct);
    ELSE
      v_is_correct := false;
    END IF;

  ELSE
    v_is_correct := false;
  END IF;

  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'daily_question_answered';

  IF FOUND AND v_source.enabled THEN
    v_points := v_source.points_value;
  ELSE
    v_points := 0;
  END IF;
  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);

  -- Persist participation + the given answer + correctness (idempotent per day).
  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, occurred_date, answer, is_correct)
  VALUES (p_tenant, v_user_id, 'daily_question_answered', v_points, v_question_id::text, v_today, p_answer, v_is_correct)
  ON CONFLICT (tenant, user_id, action_type, source_ref)
    WHERE action_type = 'daily_question_answered'
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_profile FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_answered', true,
      'is_correct', v_is_correct,
      'explanation', CASE WHEN v_explanation IS NOT NULL AND v_explanation <> '' THEN v_explanation ELSE NULL END,
      'points_awarded', 0,
      'current_streak', COALESCE(v_profile.current_streak, 0),
      'longest_streak', COALESCE(v_profile.longest_streak, 0)
    );
  END IF;

  IF NOT v_is_correct AND COALESCE(v_source.costs_life, false) THEN
    PERFORM consume_life(p_tenant, v_user_id);
  END IF;

  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
    PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
  ELSE
    INSERT INTO game_profiles (user_id, tenant)
    VALUES (v_user_id, p_tenant)
    ON CONFLICT (tenant, user_id) DO NOTHING;
    SELECT current_streak, longest_streak INTO v_new_current, v_new_longest
    FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_answered', false,
    'is_correct', v_is_correct,
    'explanation', CASE WHEN v_explanation IS NOT NULL AND v_explanation <> '' THEN v_explanation ELSE NULL END,
    'points_awarded', v_points,
    'current_streak', v_new_current,
    'longest_streak', v_new_longest
  );
END;
$$;

REVOKE ALL ON FUNCTION answer_daily_question(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION answer_daily_question(TEXT, JSONB) TO authenticated;

-- ── 3. get_daily_review ────────────────────────────────────────────────────────
-- Returns the review for TODAY's daily question for the current user. Because
-- the user has already answered, it is safe to expose correctness + explanation.
-- Shape:
--   { answered: false }                                  when not answered yet
--   { answered: true, is_correct, question: { id, type, content,
--       options: [{ text, is_correct }] | { correct_answer },
--       explanation }, given_answer }                    when answered
CREATE OR REPLACE FUNCTION get_daily_review(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_today       DATE := (timezone('America/Santiago', now()))::date;
  v_question_id UUID;
  v_event       game_point_events%ROWTYPE;
  v_q           qb_questions%ROWTYPE;
  v_options     JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT question_id INTO v_question_id
  FROM game_daily_questions
  WHERE tenant = p_tenant AND question_date = v_today;

  IF v_question_id IS NULL THEN
    RETURN jsonb_build_object('answered', false);
  END IF;

  SELECT * INTO v_event
  FROM game_point_events
  WHERE tenant = p_tenant
    AND user_id = v_user_id
    AND action_type = 'daily_question_answered'
    AND source_ref = v_question_id::text;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('answered', false);
  END IF;

  SELECT * INTO v_q FROM qb_questions WHERE id = v_question_id;

  -- Options with correctness (safe: already answered). Choice → array of
  -- { text, is_correct }; true_false → { correct_answer }.
  IF v_q.type IN ('single_choice', 'multiple_choice') AND jsonb_typeof(v_q.options) = 'array' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'text', coalesce(opt->>'text', ''),
             'is_correct', coalesce((opt->>'is_correct')::boolean, false)
           )), '[]'::jsonb)
    INTO v_options
    FROM jsonb_array_elements(v_q.options) opt;
  ELSIF v_q.type = 'true_false' THEN
    v_options := jsonb_build_object('correct_answer', coalesce((v_q.options->>'correct_answer')::boolean, false));
  ELSE
    v_options := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'answered', true,
    'is_correct', COALESCE(v_event.is_correct, false),
    'given_answer', v_event.answer,
    'question', jsonb_build_object(
      'id', v_q.id,
      'type', v_q.type,
      'content', v_q.content,
      'options', v_options,
      'explanation', CASE WHEN v_q.explanation IS NOT NULL AND v_q.explanation <> '' THEN v_q.explanation ELSE NULL END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION get_daily_review(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_review(TEXT) TO authenticated;
