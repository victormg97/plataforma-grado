-- Migration 136: Comunidad Estratégica — Cableado de vidas/baneo en gameplay,
-- filtro de ranking por moderación, y RPCs de moderación admin
-- ============================================================
-- 1. submit_quiz / answer_daily_question / submit_weekly_case_answer:
--      - PLAYER_BANNED si el jugador está baneado
--      - NO_LIVES si el sistema de vidas bloquea y no tiene vidas
--      - descuenta una vida al fallar si la fuente costs_life
-- 2. get_monthly_ranking: excluye jugadores restringidos y baneados
-- 3. Moderación admin (get_current_user_rol()='admin'):
--      restrict_player / unrestrict_player / ban_player / unban_player /
--      set_player_lives / reset_player_level / list_game_players
-- ============================================================


-- ── 1a. answer_daily_question (rewire) ────────────────────────
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

  -- Consume a life on a wrong answer if this source costs a life.
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


-- ── 1b. submit_quiz (rewire) ──────────────────────────────────
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

  IF player_is_banned(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED');
  END IF;

  IF NOT player_has_life(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES');
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

  -- Consume a life for each wrong answer if this source costs a life.
  IF COALESCE(v_source.costs_life, false) AND (v_total - v_aciertos) > 0 THEN
    FOR v_i IN 1..(v_total - v_aciertos) LOOP
      PERFORM consume_life(p_tenant, v_user_id);
    END LOOP;
  END IF;

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


-- ── 1c. submit_weekly_case_answer (rewire: ban check only) ────
-- El caso semanal no tiene "fallo" (participación), así que no consume vidas;
-- pero sí respeta el baneo.
CREATE OR REPLACE FUNCTION submit_weekly_case_answer(
  p_tenant         TEXT,
  p_case_id        UUID,
  p_answer_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_today         DATE := (timezone('America/Santiago', now()))::date;
  v_now           TIMESTAMPTZ := now();
  v_case          game_weekly_cases%ROWTYPE;
  v_status        game_weekly_case_status;
  v_is_new        BOOLEAN := false;
  v_plain         TEXT;
  v_source        game_point_sources%ROWTYPE;
  v_points        INTEGER := 0;
  v_event_id      UUID;
  v_counts_streak BOOLEAN := false;
  v_new_current   INTEGER;
  v_new_longest   INTEGER;
  v_completed     JSONB := '[]'::jsonb;
  v_event_created BOOLEAN := false;
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

  v_plain := btrim(regexp_replace(COALESCE(p_answer_content, ''), '<[^>]*>', '', 'g'));
  v_plain := btrim(replace(replace(v_plain, '&nbsp;', ''), E'\u00A0', ''));
  IF v_plain = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EMPTY_ANSWER');
  END IF;

  SELECT * INTO v_case FROM game_weekly_cases
  WHERE tenant = p_tenant AND id = p_case_id
  FOR UPDATE;

  IF NOT FOUND OR v_case.status = 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_NOT_AVAILABLE');
  END IF;

  v_status := derive_weekly_case_status(v_case.status, v_case.window_start, v_case.window_end);
  IF v_status = 'closed' AND v_case.status = 'open' THEN
    UPDATE game_weekly_cases SET status = 'closed' WHERE id = v_case.id AND status = 'open';
    v_case.status := 'closed';
  END IF;

  IF v_status <> 'open' OR v_now >= v_case.window_end OR v_now < v_case.window_start THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_CLOSED');
  END IF;

  INSERT INTO game_weekly_case_answers (
    tenant, case_id, user_id, answer_content, submitted_at, updated_at
  )
  VALUES (p_tenant, p_case_id, v_user_id, p_answer_content, now(), now())
  ON CONFLICT (tenant, case_id, user_id) DO UPDATE
    SET answer_content = EXCLUDED.answer_content,
        updated_at = now()
  RETURNING (xmax = 0) INTO v_is_new;

  IF v_is_new THEN
    SELECT * INTO v_source FROM game_point_sources
    WHERE tenant = p_tenant AND action_type = 'weekly_case_participated';

    IF FOUND AND v_source.enabled THEN
      v_points := v_source.points_value;

      INSERT INTO game_point_events (
        tenant, user_id, action_type, points_awarded, source_ref, occurred_date
      )
      VALUES (
        p_tenant, v_user_id, 'weekly_case_participated', v_points,
        p_case_id::text, v_today
      )
      ON CONFLICT (tenant, user_id, action_type, source_ref)
        WHERE action_type = 'weekly_case_participated'
        DO NOTHING
      RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        v_event_created := true;

        v_counts_streak := COALESCE(v_source.counts_for_streak, false)
                           AND COALESCE(v_source.enabled, false);
        IF v_counts_streak THEN
          SELECT o_current, o_longest INTO v_new_current, v_new_longest
          FROM apply_streak(p_tenant, v_user_id, v_today);
          PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
        END IF;

        v_completed := evaluate_challenges_for_event(v_event_id);
        PERFORM evaluate_badges_for_event(v_event_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'is_new', v_is_new,
    'points_awarded', CASE WHEN v_event_created THEN v_points ELSE 0 END,
    'completed_challenges', v_completed
  );
END;
$$;
REVOKE ALL ON FUNCTION submit_weekly_case_answer(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_weekly_case_answer(TEXT, UUID, TEXT) TO authenticated;


-- ── 2. get_monthly_ranking (excluir restringidos y baneados) ──
CREATE OR REPLACE FUNCTION get_monthly_ranking(
  p_tenant TEXT,
  p_month  DATE DEFAULT NULL,
  p_limit  INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start  DATE;
  v_month_end    DATE;
  v_show_real    BOOLEAN;
  v_total        BIGINT;
  v_entries      JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_month_start := date_trunc('month',
    COALESCE(p_month, (timezone('America/Santiago', now()))::date))::date;
  v_month_end := (v_month_start + INTERVAL '1 month')::date;

  SELECT COALESCE(show_real_name, false) INTO v_show_real
  FROM game_settings WHERE tenant = p_tenant;
  v_show_real := COALESCE(v_show_real, false);

  SELECT started_at INTO v_period_start
  FROM game_score_periods
  WHERE tenant = p_tenant AND closed_at IS NULL
  ORDER BY started_at DESC LIMIT 1;
  v_period_start := COALESCE(v_period_start, '-infinity'::timestamptz);

  WITH monthly AS (
    SELECT
      e.user_id,
      SUM(e.points_awarded) AS points,
      MIN(e.occurred_at)    AS earliest_reach
    FROM game_point_events e
    WHERE e.tenant = p_tenant
      AND e.occurred_at >= v_period_start
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
      -- Exclude restricted / banned players from the public ranking.
      AND NOT EXISTS (
        SELECT 1 FROM game_profiles gp
        WHERE gp.tenant = p_tenant AND gp.user_id = e.user_id
          AND (gp.is_restricted = true OR gp.is_banned = true)
      )
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT m.user_id, m.points,
      ROW_NUMBER() OVER (ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC) AS position
    FROM monthly m
  )
  SELECT count(*) INTO v_total FROM ranked;

  WITH monthly AS (
    SELECT
      e.user_id,
      SUM(e.points_awarded) AS points,
      MIN(e.occurred_at)    AS earliest_reach
    FROM game_point_events e
    WHERE e.tenant = p_tenant
      AND e.occurred_at >= v_period_start
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
      AND NOT EXISTS (
        SELECT 1 FROM game_profiles gp
        WHERE gp.tenant = p_tenant AND gp.user_id = e.user_id
          AND (gp.is_restricted = true OR gp.is_banned = true)
      )
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT m.user_id, m.points,
      ROW_NUMBER() OVER (ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC) AS position
    FROM monthly m
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'position', r.position,
      'user_id', r.user_id,
      'points', r.points,
      'display_name', CASE
        WHEN v_show_real THEN
          NULLIF(btrim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '')
        ELSE NULL
      END,
      'nickname', gp.nickname,
      'level', (SELECT o_level FROM compute_user_level(p_tenant, r.user_id))
    ) ORDER BY r.position
  )
  INTO v_entries
  FROM ranked r
  LEFT JOIN game_profiles gp ON gp.user_id = r.user_id AND gp.tenant = p_tenant
  LEFT JOIN profiles p ON p.id = r.user_id
  WHERE r.position > p_offset AND r.position <= p_offset + p_limit;

  RETURN jsonb_build_object(
    'month', to_char(v_month_start, 'YYYY-MM'),
    'total_entries', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'entries', COALESCE(v_entries, '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION get_monthly_ranking(TEXT, DATE, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_monthly_ranking(TEXT, DATE, INTEGER, INTEGER) TO authenticated;


-- ── 3. Moderación admin ───────────────────────────────────────

-- restrict_player: oculta el mote del jugador en el ranking hasta que lo cambie.
CREATE OR REPLACE FUNCTION restrict_player(p_tenant TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  UPDATE game_profiles
  SET is_restricted = true, restricted_at = now(), restricted_by = auth.uid()
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION restrict_player(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restrict_player(TEXT, UUID) TO authenticated;


-- unrestrict_player: levanta la restricción. El usuario debe cambiar su mote,
-- así que se limpia el nickname (forzando el onboarding de mote otra vez).
CREATE OR REPLACE FUNCTION unrestrict_player(p_tenant TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE game_profiles
  SET is_restricted = false,
      restricted_at = NULL,
      restricted_by = NULL,
      -- Force the user to pick a new nickname before reappearing.
      nickname = NULL,
      nickname_normalized = NULL,
      nickname_updated_at = NULL
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION unrestrict_player(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unrestrict_player(TEXT, UUID) TO authenticated;


-- ban_player: baneo del juego con motivo opcional.
CREATE OR REPLACE FUNCTION ban_player(p_tenant TEXT, p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  UPDATE game_profiles
  SET is_banned = true, banned_at = now(), banned_by = auth.uid(),
      ban_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION ban_player(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ban_player(TEXT, UUID, TEXT) TO authenticated;


-- unban_player: quita el baneo.
CREATE OR REPLACE FUNCTION unban_player(p_tenant TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE game_profiles
  SET is_banned = false, banned_at = NULL, banned_by = NULL, ban_reason = NULL
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION unban_player(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unban_player(TEXT, UUID) TO authenticated;


-- set_player_lives: asigna vidas a un jugador (respeta el máximo del tenant).
CREATE OR REPLACE FUNCTION set_player_lives(p_tenant TEXT, p_user_id UUID, p_lives INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT lives_max INTO v_max FROM game_settings WHERE tenant = p_tenant;
  v_max := COALESCE(v_max, 10);

  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  UPDATE game_profiles
  SET current_lives = LEAST(GREATEST(p_lives, 0), v_max),
      lives_updated_at = now()
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION set_player_lives(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_player_lives(TEXT, UUID, INTEGER) TO authenticated;


-- reset_player_level: reinicia el nivel/XP de un jugador (acumulado histórico
-- se mantiene en eventos; el XP de nivel se cuenta desde ahora).
CREATE OR REPLACE FUNCTION reset_player_level(p_tenant TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  UPDATE game_profiles
  SET xp_reset_at = now()
  WHERE tenant = p_tenant AND user_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION reset_player_level(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_player_level(TEXT, UUID) TO authenticated;


-- list_game_players: listado admin de jugadores con mote, nivel, vidas y estado
-- de moderación. Incluye solo perfiles del tenant (usuarios que accedieron al
-- juego / tienen game_profile).
CREATE OR REPLACE FUNCTION list_game_players(p_tenant TEXT, p_search TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY sort_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      lower(COALESCE(gp.nickname, p.nombre, '')) AS sort_name,
      jsonb_build_object(
        'user_id', gp.user_id,
        'nickname', gp.nickname,
        'nombre', p.nombre,
        'apellido', p.apellido,
        'email', p.email,
        'rol', p.rol,
        'current_streak', gp.current_streak,
        'level', (SELECT o_level FROM compute_user_level(p_tenant, gp.user_id)),
        'xp', (SELECT o_xp FROM compute_user_level(p_tenant, gp.user_id)),
        'current_lives', gp.current_lives,
        'is_restricted', gp.is_restricted,
        'is_banned', gp.is_banned,
        'ban_reason', gp.ban_reason
      ) AS item
    FROM game_profiles gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.tenant = p_tenant
      AND (
        p_search IS NULL OR p_search = ''
        OR gp.nickname ILIKE '%' || p_search || '%'
        OR p.nombre ILIKE '%' || p_search || '%'
        OR p.apellido ILIKE '%' || p_search || '%'
        OR p.email ILIKE '%' || p_search || '%'
      )
  ) sub;

  RETURN jsonb_build_object('players', v_result);
END;
$$;
REVOKE ALL ON FUNCTION list_game_players(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_game_players(TEXT, TEXT) TO authenticated;
