-- ============================================================
-- Migration 145: Comunidad Estratégica — Estado unificado + revisión de quiz
-- ============================================================
-- Objetivo: menos llamadas desde el front y no perder información al recargar.
--
--   1. get_daily_question_state()  — pregunta del día + already_answered en
--      UNA llamada (antes la ruta hacía 3 consultas: RPC + select + count).
--   2. get_daily_review()          — ahora incluye points_awarded, para poder
--      reconstruir la pantalla de resultado tras recargar la página.
--   3. get_ranking_page()          — ranking paginado + mi posición en UNA
--      llamada (antes 2 RPC por página).
--   4. get_game_state(parts[])     — devuelve sólo las secciones pedidas del
--      juego. Lo usan el bootstrap, el refresco al volver a la pestaña y las
--      mutaciones (para no disparar N refetch tras responder).
--   5. get_game_bootstrap()        — reescrito sobre get_game_state.
--   6. submit_quiz()               — agrega `details`: revisión por pregunta
--      (respuesta dada, solución y explicación) tras enviar.
--   7. game_answer_daily / game_submit_quiz / game_submit_weekly_case —
--      envoltorios que ejecutan la mutación y devuelven el estado actualizado
--      en la MISMA transacción (1 round-trip en vez de 1 + N refetch).
-- ============================================================


-- ── 1. get_daily_question_state ───────────────────────────────
CREATE OR REPLACE FUNCTION get_daily_question_state(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_question_id UUID;
  v_question    RECORD;
  v_already     BOOLEAN := false;
BEGIN
  -- select_daily_question enforces game_is_accessible.
  v_question_id := select_daily_question(p_tenant);

  IF v_question_id IS NULL THEN
    RETURN jsonb_build_object('question', NULL, 'already_answered', false);
  END IF;

  SELECT q.id, q.type, q.content, q.options INTO v_question
  FROM qb_questions q WHERE q.id = v_question_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('question', NULL, 'already_answered', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM game_point_events e
    WHERE e.tenant = p_tenant AND e.user_id = v_user
      AND e.action_type = 'daily_question_answered'
      AND e.source_ref = v_question_id::text
  ) INTO v_already;

  RETURN jsonb_build_object(
    'question', jsonb_build_object(
      'id', v_question.id,
      'type', v_question.type,
      'content', v_question.content,
      -- Correctness is never sent before answering.
      'options', CASE
        WHEN v_question.type IN ('single_choice', 'multiple_choice')
          AND jsonb_typeof(v_question.options) = 'array' THEN (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('text', COALESCE(opt->>'text', ''))), '[]'::jsonb)
            FROM jsonb_array_elements(v_question.options) opt
          )
        WHEN v_question.type = 'true_false' THEN '{}'::jsonb
        ELSE '[]'::jsonb
      END
    ),
    'already_answered', v_already
  );
END;
$$;

REVOKE ALL ON FUNCTION get_daily_question_state(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_question_state(TEXT) TO authenticated;


-- ── 2. get_daily_review (+ points_awarded) ────────────────────
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

  IF v_q.type IN ('single_choice', 'multiple_choice') AND jsonb_typeof(v_q.options) = 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'text', COALESCE(opt->>'text', ''),
             'is_correct', COALESCE((opt->>'is_correct')::boolean, false)
           )), '[]'::jsonb)
    INTO v_options
    FROM jsonb_array_elements(v_q.options) opt;
  ELSIF v_q.type = 'true_false' THEN
    v_options := jsonb_build_object('correct_answer', COALESCE((v_q.options->>'correct_answer')::boolean, false));
  ELSE
    v_options := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'answered', true,
    'is_correct', COALESCE(v_event.is_correct, false),
    'points_awarded', COALESCE(v_event.points_awarded, 0),
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


-- ── 3. get_ranking_page ───────────────────────────────────────
CREATE OR REPLACE FUNCTION get_ranking_page(
  p_tenant TEXT,
  p_month  DATE DEFAULT NULL,
  p_limit  INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ranking JSONB;
  v_pos     JSONB;
BEGIN
  v_ranking := get_monthly_ranking(p_tenant, p_month, p_limit, p_offset);
  v_pos := get_my_ranking_position(p_tenant, p_month);
  RETURN COALESCE(v_ranking, '{}'::jsonb)
    || jsonb_build_object('my_position', COALESCE(v_pos, jsonb_build_object('has_position', false)));
END;
$$;

REVOKE ALL ON FUNCTION get_ranking_page(TEXT, DATE, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_ranking_page(TEXT, DATE, INTEGER, INTEGER) TO authenticated;


-- ── 4. get_game_state ─────────────────────────────────────────
-- p_parts: subset of settings, profile, daily_question, daily_review,
-- quiz_subjects, ranking, challenges, badges, weekly_case. NULL = all.
CREATE OR REPLACE FUNCTION get_game_state(p_tenant TEXT, p_parts TEXT[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all    BOOLEAN := p_parts IS NULL;
  v_result JSONB := '{}'::jsonb;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_all OR 'settings' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('settings',
      (SELECT to_jsonb(gs.*) FROM game_settings gs WHERE gs.tenant = p_tenant));
  END IF;
  IF v_all OR 'profile' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('profile', get_game_profile(p_tenant));
  END IF;
  IF v_all OR 'daily_question' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('daily_question', get_daily_question_state(p_tenant));
  END IF;
  IF v_all OR 'daily_review' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('daily_review', get_daily_review(p_tenant));
  END IF;
  IF v_all OR 'quiz_subjects' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('quiz_subjects', get_quiz_subjects(p_tenant));
  END IF;
  IF v_all OR 'ranking' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('ranking', get_ranking_page(p_tenant, NULL, 20, 0));
  END IF;
  IF v_all OR 'challenges' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('challenges', get_active_challenges(p_tenant));
  END IF;
  IF v_all OR 'badges' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('badges', get_user_badges(p_tenant));
  END IF;
  IF v_all OR 'weekly_case' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('weekly_case', get_current_weekly_case(p_tenant));
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_game_state(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_game_state(TEXT, TEXT[]) TO authenticated;


-- ── 5. get_game_bootstrap (sobre get_game_state) ──────────────
CREATE OR REPLACE FUNCTION get_game_bootstrap(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RETURN jsonb_build_object('accessible', false);
  END IF;
  RETURN jsonb_build_object('accessible', true) || get_game_state(p_tenant, NULL);
END;
$$;


-- ── 6. submit_quiz (+ details por pregunta) ───────────────────
CREATE OR REPLACE FUNCTION submit_quiz(p_tenant TEXT, p_subject_id UUID, p_category_id UUID, p_answers JSONB)
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
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED'); END IF;
  IF NOT game_is_accessible(p_tenant) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF player_is_banned(p_tenant, v_user_id) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED'); END IF;
  IF NOT player_has_life(p_tenant, v_user_id) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES'); END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_ANSWERS'); END IF;

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
    'points_awarded', v_points, 'scoring_mode', v_scoring, 'completed_challenges', v_completed,
    'details', v_details);
END;
$$;


-- ── 7. Mutaciones + estado en una sola transacción ────────────
CREATE OR REPLACE FUNCTION game_answer_daily(p_tenant TEXT, p_answer JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := answer_daily_question(p_tenant, p_answer);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('state', get_game_state(p_tenant,
      ARRAY['profile', 'daily_question', 'daily_review', 'badges', 'challenges', 'ranking']));
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION game_answer_daily(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION game_answer_daily(TEXT, JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION game_submit_quiz(p_tenant TEXT, p_subject_id UUID, p_category_id UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := submit_quiz(p_tenant, p_subject_id, p_category_id, p_answers);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('state', get_game_state(p_tenant,
      ARRAY['profile', 'badges', 'challenges', 'ranking']));
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION game_submit_quiz(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION game_submit_quiz(TEXT, UUID, UUID, JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION game_submit_weekly_case(p_tenant TEXT, p_case_id UUID, p_answer_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := submit_weekly_case_answer(p_tenant, p_case_id, p_answer_content);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('state', get_game_state(p_tenant,
      ARRAY['weekly_case', 'profile', 'badges', 'challenges', 'ranking']));
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION game_submit_weekly_case(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION game_submit_weekly_case(TEXT, UUID, TEXT) TO authenticated;


-- ── 8. select_daily_question: sólo tipos que la Pregunta del Día soporta ──
-- Bug: el sorteo automático elegía cualquier pregunta activa (incluidas
-- matching / fill_blank). La UI las mostraba como Verdadero/Falso, nunca
-- podían acertarse, y el bootstrap enviaba sus opciones crudas (con la
-- solución). Ahora el sorteo se limita a single/multiple choice y V/F, y
-- get_daily_question_state nunca envía opciones de otros tipos.
CREATE OR REPLACE FUNCTION select_daily_question(p_tenant TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := (timezone('America/Santiago', now()))::date;
  v_question_id UUID;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO game_daily_questions (tenant, question_date, question_id, is_manually_curated)
  SELECT p_tenant, v_today, q.id, false
  FROM qb_questions q
  WHERE q.tenant = p_tenant AND q.status = 'active'
    AND q.type IN ('single_choice', 'multiple_choice', 'true_false')
  ORDER BY random()
  LIMIT 1
  ON CONFLICT (tenant, question_date) DO NOTHING;

  SELECT question_id INTO v_question_id
  FROM game_daily_questions
  WHERE tenant = p_tenant AND question_date = v_today;

  RETURN v_question_id;
END;
$$;


-- ── 9. Sin acceso anónimo a los RPC nuevos ────────────────────
-- Supabase otorga EXECUTE a anon por defecto en funciones nuevas; estas sólo
-- tienen sentido con sesión (y validan auth.uid()), así que se lo quitamos.
REVOKE EXECUTE ON FUNCTION get_daily_question_state(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION get_ranking_page(TEXT, DATE, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION get_game_state(TEXT, TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION game_answer_daily(TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION game_submit_quiz(TEXT, UUID, UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION game_submit_weekly_case(TEXT, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION game_effective_streak(INTEGER, DATE, DATE) FROM anon;
