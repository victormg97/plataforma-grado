-- Migration 126 (cont.): rewire submit_quiz and answer_daily_question to fire badge evaluators

CREATE OR REPLACE FUNCTION submit_quiz(
  p_tenant      TEXT,
  p_subject_id  UUID,
  p_category_id UUID,
  p_answers     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_today         DATE := (timezone('America/Santiago', now()))::date;
  v_ans           JSONB;
  v_qid           UUID;
  v_qtype         qb_question_type;
  v_options       JSONB;
  v_correct_set   INT[];
  v_selected_set  INT[];
  v_tf_correct    BOOLEAN;
  v_is_correct    BOOLEAN;
  v_total         INTEGER := 0;
  v_aciertos      INTEGER := 0;
  v_source        game_point_sources%ROWTYPE;
  v_base_points   INTEGER := 0;
  v_scoring       game_scoring_mode;
  v_points        INTEGER := 0;
  v_event_id      UUID;
  v_counts_streak BOOLEAN := false;
  v_new_current   INTEGER;
  v_new_longest   INTEGER;
  v_completed     JSONB := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_ANSWERS');
  END IF;

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_qid := (v_ans ->> 'question_id')::uuid;

    SELECT type, options INTO v_qtype, v_options
    FROM qb_questions
    WHERE id = v_qid
      AND tenant = p_tenant
      AND status = 'active'
      AND subject_id = p_subject_id
      AND (p_category_id IS NULL OR category_id = p_category_id);

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_total := v_total + 1;
    v_is_correct := false;

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
      FROM jsonb_array_elements_text(COALESCE(v_ans -> 'selected', '[]'::jsonb)) AS val;

      v_is_correct := (v_selected_set = v_correct_set);

    ELSIF v_qtype = 'true_false' THEN
      v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
      IF (v_ans ? 'value') THEN
        v_is_correct := ((v_ans ->> 'value')::boolean = v_tf_correct);
      END IF;
    END IF;

    IF v_is_correct THEN
      v_aciertos := v_aciertos + 1;
    END IF;
  END LOOP;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'quiz_completed';

  IF FOUND AND v_source.enabled THEN
    v_base_points := v_source.points_value;
  ELSE
    v_base_points := 0;
  END IF;

  SELECT COALESCE(scoring_mode, 'fixed') INTO v_scoring
  FROM game_settings WHERE tenant = p_tenant;
  v_scoring := COALESCE(v_scoring, 'fixed');

  IF v_scoring = 'proportional' THEN
    v_points := GREATEST(ROUND(v_base_points * v_aciertos::numeric / v_total)::int, 0);
  ELSE
    v_points := v_base_points;
  END IF;

  INSERT INTO game_point_events (
    tenant, user_id, action_type, points_awarded, source_ref,
    subject_id, category_id, occurred_date
  )
  VALUES (
    p_tenant, v_user_id, 'quiz_completed', v_points, gen_random_uuid()::text,
    p_subject_id, p_category_id, v_today
  )
  RETURNING id INTO v_event_id;

  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);
  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
    PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
  END IF;

  v_completed := evaluate_challenges_for_event(v_event_id);

  PERFORM evaluate_badges_for_event(v_event_id);

  RETURN jsonb_build_object(
    'ok', true,
    'aciertos', v_aciertos,
    'total_presented', v_total,
    'points_awarded', v_points,
    'scoring_mode', v_scoring,
    'completed_challenges', v_completed
  );
END;
$$;
REVOKE ALL ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) TO authenticated;


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

  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, occurred_date)
  VALUES (p_tenant, v_user_id, 'daily_question_answered', v_points, v_question_id::text, v_today)
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
