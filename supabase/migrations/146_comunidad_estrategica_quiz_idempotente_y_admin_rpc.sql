-- ============================================================
-- Migration 146: Comunidad Estratégica — Quiz idempotente + RPC del admin
-- ============================================================
--   1. Índice único para quiz_completed por intento (source_ref = attempt_id).
--   2. start_quiz()      — devuelve un attempt_id por intento.
--   3. submit_quiz() / game_submit_quiz() — aceptan p_attempt_id. Reenviar el
--      mismo intento (corte de red, recarga justo después de enviar) NO vuelve
--      a sumar puntos, descontar vidas ni avanzar desafíos: devuelve el mismo
--      resultado con already_submitted = true.
--   4. admin_list_game_badges()      — insignias + grant_count contado en SQL
--      (antes se traían TODAS las filas de user_badges para contar en JS).
--   5. admin_list_daily_questions()  — historial de preguntas del día con
--      contenido/tipo/materia en 1 consulta (antes 3 secuenciales).
--   6. get_game_admin_bootstrap()    — todo el panel admin en 1 RPC (antes
--      ~16 consultas). Compuesto por funciones por dominio, así cada pestaña
--      sigue teniendo su propia función.
-- ============================================================


-- ── 1. Unicidad de intentos de cuestionario ───────────────────
-- Los eventos existentes tienen source_ref aleatorio (gen_random_uuid), así
-- que no hay duplicados previos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_point_events_quiz_attempt
  ON game_point_events (tenant, user_id, action_type, source_ref)
  WHERE action_type = 'quiz_completed';


-- ── 2. start_quiz (+ attempt_id) ──────────────────────────────
CREATE OR REPLACE FUNCTION start_quiz(p_tenant TEXT, p_subject_id UUID, p_category_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_count       INTEGER;
  v_available   INTEGER;
  v_take        INTEGER;
  v_questions   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;
  IF player_is_banned(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED');
  END IF;
  IF NOT player_has_life(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES');
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
      CASE
        WHEN q.type IN ('single_choice', 'multiple_choice') AND jsonb_typeof(q.options) = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('text', elem ->> 'text'))
             FROM jsonb_array_elements(q.options) AS elem),
          '[]'::jsonb
        )
        ELSE '[]'::jsonb
      END AS options,
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(p ->> 'left' ORDER BY ord)
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_left,
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('key', ord - 1, 'text', p ->> 'right') ORDER BY random())
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_right,
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
    'attempt_id', gen_random_uuid(),
    'subject_id', p_subject_id,
    'category_id', p_category_id,
    'question_count', v_take,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;


-- ── 3. submit_quiz / game_submit_quiz con p_attempt_id ────────
-- La firma cambia: se eliminan las versiones de 4 parámetros para no dejar
-- sobrecargas ambiguas.
DROP FUNCTION IF EXISTS game_submit_quiz(TEXT, UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS submit_quiz(TEXT, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION submit_quiz(
  p_tenant TEXT,
  p_subject_id UUID,
  p_category_id UUID,
  p_answers JSONB,
  p_attempt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_today DATE := (timezone('America/Santiago', now()))::date;
  v_ans JSONB; v_qid UUID; v_qtype qb_question_type; v_options JSONB; v_content TEXT; v_explanation TEXT;
  v_correct_set INT[]; v_selected_set INT[]; v_tf_correct BOOLEAN; v_is_correct BOOLEAN;
  v_total INTEGER := 0; v_aciertos INTEGER := 0; v_source game_point_sources%ROWTYPE;
  v_base_points INTEGER := 0; v_scoring game_scoring_mode; v_points INTEGER := 0;
  v_event_id UUID; v_counts_streak BOOLEAN := false; v_new_current INTEGER; v_new_longest INTEGER;
  v_completed JSONB := '[]'::jsonb; v_i INTEGER;
  v_pair_count INTEGER; v_match_ok BOOLEAN; v_matches JSONB;
  v_blank_count INTEGER; v_blanks JSONB; v_accepted JSONB; v_given TEXT; v_blank_ok BOOLEAN;
  v_details JSONB := '[]'::jsonb; v_solution JSONB;
  v_ref TEXT := COALESCE(p_attempt_id, gen_random_uuid())::text;
  v_dup BOOLEAN := false; v_dup_points INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED'); END IF;
  IF NOT game_is_accessible(p_tenant) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF player_is_banned(p_tenant, v_user_id) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED'); END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_ANSWERS'); END IF;

  -- Already submitted? Replay the result without side effects (and without
  -- the lives gate: the first submit may have spent the last life).
  IF p_attempt_id IS NOT NULL THEN
    SELECT points_awarded INTO v_dup_points
    FROM game_point_events
    WHERE tenant = p_tenant AND user_id = v_user_id
      AND action_type = 'quiz_completed' AND source_ref = v_ref;
    v_dup := FOUND;
  END IF;

  IF NOT v_dup AND NOT player_has_life(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES');
  END IF;

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    v_qid := (v_ans ->> 'question_id')::uuid;
    SELECT type, options, content, explanation INTO v_qtype, v_options, v_content, v_explanation FROM qb_questions
    WHERE id = v_qid AND tenant = p_tenant AND status = 'active' AND subject_id = p_subject_id
      AND (p_category_id IS NULL OR category_id = p_category_id);
    IF NOT FOUND THEN CONTINUE; END IF;
    v_total := v_total + 1; v_is_correct := false; v_solution := NULL;

    IF v_qtype IN ('single_choice', 'multiple_choice') THEN
      SELECT COALESCE(array_agg(ord ORDER BY ord), '{}') INTO v_correct_set
      FROM (SELECT (idx - 1) AS ord FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
            WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)) c;
      SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}') INTO v_selected_set
      FROM jsonb_array_elements_text(COALESCE(v_ans -> 'selected', '[]'::jsonb)) AS val;
      v_is_correct := (v_selected_set = v_correct_set);
      IF jsonb_typeof(v_options) = 'array' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'text', COALESCE(o ->> 'text', ''),
                 'is_correct', COALESCE((o ->> 'is_correct')::boolean, false)) ORDER BY ord), '[]'::jsonb)
        INTO v_solution
        FROM jsonb_array_elements(v_options) WITH ORDINALITY AS x(o, ord);
      END IF;

    ELSIF v_qtype = 'true_false' THEN
      v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
      IF (v_ans ? 'value') THEN v_is_correct := ((v_ans ->> 'value')::boolean = v_tf_correct); END IF;
      v_solution := jsonb_build_object('correct_answer', v_tf_correct);

    ELSIF v_qtype = 'matching' THEN
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
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'left', COALESCE(p ->> 'left', ''), 'right', COALESCE(p ->> 'right', '')) ORDER BY ord), '[]'::jsonb)
        INTO v_solution
        FROM jsonb_array_elements(v_options -> 'pairs') WITH ORDINALITY AS x(p, ord);
        v_solution := jsonb_build_object('pairs', v_solution);
      END IF;

    ELSIF v_qtype = 'fill_blank' THEN
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
        SELECT COALESCE(jsonb_agg(
                 CASE WHEN jsonb_typeof(b -> 'accepted_answers') = 'array' THEN b -> 'accepted_answers' ELSE '[]'::jsonb END
                 ORDER BY ord), '[]'::jsonb)
        INTO v_solution
        FROM jsonb_array_elements(v_options -> 'blanks') WITH ORDINALITY AS x(b, ord);
        v_solution := jsonb_build_object('blanks', v_solution);
      END IF;
    END IF;

    IF v_is_correct THEN v_aciertos := v_aciertos + 1; END IF;

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'question_id', v_qid,
      'type', v_qtype,
      'content', v_content,
      'is_correct', v_is_correct,
      'answer', v_ans,
      'solution', v_solution,
      'explanation', CASE WHEN v_explanation IS NOT NULL AND v_explanation <> '' THEN v_explanation ELSE NULL END
    ));
  END LOOP;

  IF v_total = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS'); END IF;

  SELECT COALESCE(scoring_mode, 'fixed') INTO v_scoring FROM game_settings WHERE tenant = p_tenant;
  v_scoring := COALESCE(v_scoring, 'fixed');

  IF v_dup THEN
    RETURN jsonb_build_object('ok', true, 'already_submitted', true, 'attempt_id', v_ref,
      'aciertos', v_aciertos, 'total_presented', v_total,
      'points_awarded', COALESCE(v_dup_points, 0), 'scoring_mode', v_scoring,
      'completed_challenges', '[]'::jsonb, 'details', v_details);
  END IF;

  SELECT * INTO v_source FROM game_point_sources WHERE tenant = p_tenant AND action_type = 'quiz_completed';
  IF FOUND AND v_source.enabled THEN v_base_points := v_source.points_value; ELSE v_base_points := 0; END IF;
  IF v_scoring = 'proportional' THEN v_points := GREATEST(ROUND(v_base_points * v_aciertos::numeric / v_total)::int, 0);
  ELSE v_points := v_base_points; END IF;

  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, subject_id, category_id, occurred_date)
  VALUES (p_tenant, v_user_id, 'quiz_completed', v_points, v_ref, p_subject_id, p_category_id, v_today)
  ON CONFLICT (tenant, user_id, action_type, source_ref) WHERE action_type = 'quiz_completed'
  DO NOTHING
  RETURNING id INTO v_event_id;

  -- Lost a race against an identical concurrent submit: replay.
  IF v_event_id IS NULL THEN
    SELECT points_awarded INTO v_dup_points
    FROM game_point_events
    WHERE tenant = p_tenant AND user_id = v_user_id
      AND action_type = 'quiz_completed' AND source_ref = v_ref;
    RETURN jsonb_build_object('ok', true, 'already_submitted', true, 'attempt_id', v_ref,
      'aciertos', v_aciertos, 'total_presented', v_total,
      'points_awarded', COALESCE(v_dup_points, 0), 'scoring_mode', v_scoring,
      'completed_challenges', '[]'::jsonb, 'details', v_details);
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'already_submitted', false, 'attempt_id', v_ref,
    'aciertos', v_aciertos, 'total_presented', v_total,
    'points_awarded', v_points, 'scoring_mode', v_scoring, 'completed_challenges', v_completed,
    'details', v_details);
END;
$$;

REVOKE ALL ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION game_submit_quiz(
  p_tenant TEXT,
  p_subject_id UUID,
  p_category_id UUID,
  p_answers JSONB,
  p_attempt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := submit_quiz(p_tenant, p_subject_id, p_category_id, p_answers, p_attempt_id);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('state', get_game_state(p_tenant,
      ARRAY['profile', 'badges', 'challenges', 'ranking']));
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION game_submit_quiz(TEXT, UUID, UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game_submit_quiz(TEXT, UUID, UUID, JSONB, UUID) TO authenticated;


-- ── 4. admin_list_game_badges ─────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_game_badges(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      to_jsonb(b.*) || jsonb_build_object('grant_count', COALESCE(c.n, 0))
      ORDER BY b.series_key ASC NULLS LAST, b.series_order ASC NULLS LAST, b.name ASC
    )
    FROM game_badges b
    LEFT JOIN (
      SELECT badge_id, count(*)::int AS n
      FROM user_badges WHERE tenant = p_tenant
      GROUP BY badge_id
    ) c ON c.badge_id = b.id
    WHERE b.tenant = p_tenant
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION admin_list_game_badges(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_game_badges(TEXT) TO authenticated;


-- ── 5. admin_list_daily_questions ─────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_daily_questions(
  p_tenant TEXT,
  p_from   DATE DEFAULT NULL,
  p_to     DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY qdate DESC)
    FROM (
      SELECT d.question_date AS qdate,
        jsonb_build_object(
          'id', d.id,
          'question_date', d.question_date,
          'question_id', d.question_id,
          'is_manually_curated', d.is_manually_curated,
          'question_content', q.content,
          'question_type', q.type,
          'subject_name', s.name
        ) AS row
      FROM game_daily_questions d
      LEFT JOIN qb_questions q ON q.id = d.question_id AND q.tenant = p_tenant
      LEFT JOIN qb_subjects s ON s.id = q.subject_id
      WHERE d.tenant = p_tenant
        AND (p_from IS NULL OR d.question_date >= p_from)
        AND (p_to IS NULL OR d.question_date <= p_to)
      ORDER BY d.question_date DESC
      LIMIT 60
    ) sub
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION admin_list_daily_questions(TEXT, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_daily_questions(TEXT, DATE, DATE) TO authenticated;


-- ── 6. get_game_admin_bootstrap ───────────────────────────────
-- Cada sección mantiene la forma exacta de su ruta GET (y su queryKey).
CREATE OR REPLACE FUNCTION get_game_admin_bootstrap(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(gs.*) FROM game_settings gs WHERE gs.tenant = p_tenant),
    'point_sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(ps.*) ORDER BY ps.action_type)
      FROM game_point_sources ps WHERE ps.tenant = p_tenant), '[]'::jsonb),
    'streak_thresholds', COALESCE((
      SELECT jsonb_agg(to_jsonb(st.*) ORDER BY st.days)
      FROM game_streak_thresholds st WHERE st.tenant = p_tenant), '[]'::jsonb),
    'levels', COALESCE((
      SELECT jsonb_agg(to_jsonb(lt.*) ORDER BY lt.level)
      FROM game_level_thresholds lt WHERE lt.tenant = p_tenant), '[]'::jsonb),
    'challenges', COALESCE((
      SELECT jsonb_agg(to_jsonb(ch.*) ORDER BY ch.created_at DESC)
      FROM game_challenges ch WHERE ch.tenant = p_tenant), '[]'::jsonb),
    'weekly_cases', COALESCE((
      SELECT jsonb_agg(to_jsonb(wc.*) ORDER BY wc.window_start DESC)
      FROM game_weekly_cases wc WHERE wc.tenant = p_tenant), '[]'::jsonb),
    'score_reset_log', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'executed_by', l.executed_by,
               'executed_at', l.executed_at, 'reset_scope', l.reset_scope)
             ORDER BY l.executed_at DESC)
      FROM (
        SELECT * FROM game_score_reset_log
        WHERE tenant = p_tenant ORDER BY executed_at DESC LIMIT 20
      ) l), '[]'::jsonb),
    'badges', admin_list_game_badges(p_tenant),
    'daily_questions', admin_list_daily_questions(p_tenant, NULL, NULL),
    'players', COALESCE(list_game_players(p_tenant, '') -> 'players', '[]'::jsonb),
    'stats', get_game_stats(p_tenant)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_game_admin_bootstrap(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_game_admin_bootstrap(TEXT) TO authenticated;


-- ── 7. start_quiz sin acceso anónimo ──────────────────────────
REVOKE EXECUTE ON FUNCTION start_quiz(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_quiz(TEXT, UUID, UUID) TO authenticated;
