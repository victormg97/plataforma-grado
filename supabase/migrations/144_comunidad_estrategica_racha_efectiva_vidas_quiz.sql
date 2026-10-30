-- ============================================================
-- Migration 144: Comunidad Estratégica — Racha efectiva + guardas de quiz
-- ============================================================
-- Bug: current_streak sólo se recalculaba al registrar una nueva actividad
-- (apply_streak). Si el jugador dejaba de jugar varios días, el perfil seguía
-- mostrando la racha antigua (ej. 3) hasta su próxima jugada.
--
-- Cambios:
--   1. game_profiles.previous_streak — largo de la última racha que se perdió
--      (para mostrar "Racha anterior" en la UI).
--   2. game_effective_streak()       — racha vigente calculada al leer:
--      0 si la última actividad es anterior a ayer (America/Santiago).
--   3. apply_streak()                — al reiniciar por inactividad guarda la
--      racha perdida en previous_streak.
--   4. get_game_profile()            — devuelve la racha efectiva + estado
--      (streak_status) + previous_streak.
--   5. get_game_stats() / list_game_players() — usan la racha efectiva.
--   6. start_quiz()                  — rechaza jugadores baneados o sin vidas
--      ANTES de mostrar preguntas (antes fallaba recién al enviar).
-- ============================================================


-- ── 1. previous_streak ────────────────────────────────────────
ALTER TABLE game_profiles
  ADD COLUMN IF NOT EXISTS previous_streak INTEGER NOT NULL DEFAULT 0
  CHECK (previous_streak >= 0);


-- ── 2. game_effective_streak ──────────────────────────────────
-- La racha sigue viva si la última actividad fue hoy o ayer.
CREATE OR REPLACE FUNCTION game_effective_streak(
  p_current INTEGER,
  p_last    DATE,
  p_today   DATE
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_last IS NOT NULL AND p_last >= p_today - 1 THEN COALESCE(p_current, 0)
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION game_effective_streak(INTEGER, DATE, DATE) TO authenticated;


-- ── 3. apply_streak ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION apply_streak(
  p_tenant  TEXT,
  p_user_id UUID,
  p_today   DATE,
  OUT o_current INTEGER,
  OUT o_longest INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile  game_profiles%ROWTYPE;
  v_previous INTEGER;
BEGIN
  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  SELECT * INTO v_profile FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;

  v_previous := v_profile.previous_streak;

  IF v_profile.last_activity_date IS NULL THEN
    o_current := 1;
  ELSIF v_profile.last_activity_date = p_today THEN
    o_current := GREATEST(v_profile.current_streak, 1);
  ELSIF v_profile.last_activity_date = (p_today - 1) THEN
    o_current := v_profile.current_streak + 1;
  ELSE
    -- Gap greater than one calendar day: reset and remember the lost streak.
    o_current := 1;
    IF COALESCE(v_profile.current_streak, 0) > 0 THEN
      v_previous := v_profile.current_streak;
    END IF;
  END IF;

  o_longest := GREATEST(v_profile.longest_streak, o_current);

  UPDATE game_profiles
  SET current_streak     = o_current,
      longest_streak     = o_longest,
      previous_streak    = COALESCE(v_previous, 0),
      last_activity_date = p_today
  WHERE tenant = p_tenant AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION apply_streak(TEXT, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_streak(TEXT, UUID, DATE) TO authenticated;


-- ── 4. get_game_profile ───────────────────────────────────────
-- streak_status:
--   'none'    → nunca ha tenido racha
--   'active'  → ya jugó hoy (racha a salvo)
--   'at_risk' → jugó ayer, aún no hoy (la pierde si no juega hoy)
--   'broken'  → la racha se perdió por inactividad (current_streak = 0)
CREATE OR REPLACE FUNCTION get_game_profile(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_today    DATE := (timezone('America/Santiago', now()))::date;
  v_prof     game_profiles%ROWTYPE;
  v_lives    INTEGER; v_lmax INTEGER; v_lenabled BOOLEAN; v_next TIMESTAMPTZ;
  v_block    BOOLEAN;
  v_level    INTEGER; v_xp INTEGER; v_cur_min INTEGER; v_next_min INTEGER;
  v_recent   JSONB;
  v_stored   INTEGER;
  v_current  INTEGER;
  v_broken   BOOLEAN;
  v_status   TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501'; END IF;
  IF NOT game_is_accessible(p_tenant) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;

  SELECT o_lives, o_max, o_enabled, o_next_regen INTO v_lives, v_lmax, v_lenabled, v_next
  FROM regen_and_get_lives(p_tenant, v_user_id);

  SELECT COALESCE(lives_block_when_empty, true) INTO v_block FROM game_settings WHERE tenant = p_tenant;

  SELECT * INTO v_prof FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;

  SELECT o_level, o_xp, o_current_min, o_next_min INTO v_level, v_xp, v_cur_min, v_next_min
  FROM compute_user_level(p_tenant, v_user_id);

  v_recent := get_recent_achievements(p_tenant, NULL);

  v_stored  := COALESCE(v_prof.current_streak, 0);
  v_current := game_effective_streak(v_stored, v_prof.last_activity_date, v_today);
  v_broken  := v_stored > 0 AND v_current = 0;

  v_status := CASE
    WHEN v_broken THEN 'broken'
    WHEN v_current > 0 AND v_prof.last_activity_date = v_today THEN 'active'
    WHEN v_current > 0 THEN 'at_risk'
    ELSE 'none'
  END;

  RETURN jsonb_build_object(
    'nickname', v_prof.nickname,
    'current_streak', v_current,
    'longest_streak', COALESCE(v_prof.longest_streak, 0),
    -- While broken, the lost streak is still stored in current_streak.
    'previous_streak', CASE WHEN v_broken THEN v_stored ELSE COALESCE(v_prof.previous_streak, 0) END,
    'streak_status', v_status,
    'last_activity_date', v_prof.last_activity_date,
    'nickname_updated_at', v_prof.nickname_updated_at,
    'lives', jsonb_build_object('enabled', v_lenabled, 'current', v_lives, 'max', v_lmax, 'next_regen', v_next, 'block_when_empty', COALESCE(v_block, true)),
    'level', jsonb_build_object('level', v_level, 'xp', v_xp, 'current_min', v_cur_min, 'next_min', v_next_min),
    'moderation', jsonb_build_object('is_restricted', COALESCE(v_prof.is_restricted, false), 'is_banned', COALESCE(v_prof.is_banned, false), 'ban_reason', v_prof.ban_reason),
    'recent_achievements', COALESCE(v_recent -> 'achievements', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_game_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_game_profile(TEXT) TO authenticated;


-- ── 5a. get_game_stats (distribución con racha efectiva) ──────
CREATE OR REPLACE FUNCTION get_game_stats(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := (timezone('America/Santiago', now()))::date;
  v_week_start  DATE := date_trunc('week', v_today)::date;
  v_month_start DATE := date_trunc('month', v_today)::date;
  v_dau         INTEGER;
  v_wau         INTEGER;
  v_mau         INTEGER;
  v_quizzes     INTEGER;
  v_daily_resp  INTEGER;
  v_accessible  INTEGER;
  v_streak_dist JSONB;
  v_ranking     JSONB;
  v_top_badges  JSONB;
  v_bottom_badges JSONB;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(DISTINCT user_id) INTO v_dau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date = v_today;

  SELECT count(DISTINCT user_id) INTO v_wau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date >= v_week_start;

  SELECT count(DISTINCT user_id) INTO v_mau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date >= v_month_start;

  SELECT count(*) INTO v_quizzes
  FROM game_point_events
  WHERE tenant = p_tenant AND action_type = 'quiz_completed';

  SELECT count(DISTINCT user_id) INTO v_daily_resp
  FROM game_point_events
  WHERE tenant = p_tenant AND action_type = 'daily_question_answered'
    AND (timezone('America/Santiago', occurred_at))::date = v_today;

  SELECT count(*) INTO v_accessible
  FROM game_profiles WHERE tenant = p_tenant;

  SELECT jsonb_build_object(
    'none',      count(*) FILTER (WHERE s = 0),
    'from_1_2',  count(*) FILTER (WHERE s BETWEEN 1 AND 2),
    'from_3_6',  count(*) FILTER (WHERE s BETWEEN 3 AND 6),
    'from_7_14', count(*) FILTER (WHERE s BETWEEN 7 AND 14),
    'from_15_29',count(*) FILTER (WHERE s BETWEEN 15 AND 29),
    'from_30',   count(*) FILTER (WHERE s >= 30)
  ) INTO v_streak_dist
  FROM (
    SELECT game_effective_streak(current_streak, last_activity_date, v_today) AS s
    FROM game_profiles WHERE tenant = p_tenant
  ) eff;

  SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'position')::int), '[]'::jsonb) INTO v_ranking
  FROM (
    SELECT jsonb_build_object(
      'position', ROW_NUMBER() OVER (ORDER BY sum(e.points_awarded) DESC, min(e.occurred_at) ASC, e.user_id ASC),
      'user_id', e.user_id,
      'display_name', COALESCE(gp.nickname, 'Jugador'),
      'points', sum(e.points_awarded)
    ) AS r
    FROM game_point_events e
    LEFT JOIN game_profiles gp ON gp.tenant = e.tenant AND gp.user_id = e.user_id
    WHERE e.tenant = p_tenant
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
    GROUP BY e.user_id, gp.nickname
    ORDER BY sum(e.points_awarded) DESC, min(e.occurred_at) ASC, e.user_id ASC
    LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(b ORDER BY (b->>'count')::int DESC), '[]'::jsonb) INTO v_top_badges
  FROM (
    SELECT jsonb_build_object('badge_id', ub.badge_id, 'name', gb.name, 'count', count(*)) AS b
    FROM user_badges ub
    JOIN game_badges gb ON gb.id = ub.badge_id
    WHERE ub.tenant = p_tenant AND gb.deleted_at IS NULL
    GROUP BY ub.badge_id, gb.name
    ORDER BY count(*) DESC
    LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(b ORDER BY (b->>'count')::int ASC), '[]'::jsonb) INTO v_bottom_badges
  FROM (
    SELECT jsonb_build_object('badge_id', gb.id, 'name', gb.name, 'count', count(ub.id)) AS b
    FROM game_badges gb
    LEFT JOIN user_badges ub ON ub.badge_id = gb.id AND ub.tenant = p_tenant
    WHERE gb.tenant = p_tenant AND gb.enabled = true AND gb.deleted_at IS NULL
    GROUP BY gb.id, gb.name
    ORDER BY count(ub.id) ASC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'active_users', jsonb_build_object('daily', COALESCE(v_dau, 0), 'weekly', COALESCE(v_wau, 0), 'monthly', COALESCE(v_mau, 0)),
    'daily_question', jsonb_build_object(
      'respondents', COALESCE(v_daily_resp, 0),
      'eligible', COALESCE(v_accessible, 0),
      'rate', CASE WHEN COALESCE(v_accessible, 0) > 0 THEN ROUND(v_daily_resp::numeric / v_accessible, 4) ELSE 0 END
    ),
    'quizzes_completed', COALESCE(v_quizzes, 0),
    'streak_distribution', v_streak_dist,
    'ranking_preview', v_ranking,
    'badges_most_unlocked', v_top_badges,
    'badges_least_unlocked', v_bottom_badges
  );
END;
$$;


-- ── 5b. list_game_players (racha efectiva) ────────────────────
CREATE OR REPLACE FUNCTION list_game_players(p_tenant TEXT, p_search TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_today  DATE := (timezone('America/Santiago', now()))::date;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(item ORDER BY sort_name), '[]'::jsonb) INTO v_result
  FROM (
    SELECT lower(COALESCE(gp.nickname, p.nombre, '')) AS sort_name,
      jsonb_build_object(
        'user_id', gp.user_id, 'nickname', gp.nickname, 'nombre', p.nombre, 'apellido', p.apellido,
        'email', p.email, 'rol', p.rol,
        'current_streak', game_effective_streak(gp.current_streak, gp.last_activity_date, v_today),
        'level', (SELECT o_level FROM compute_user_level(p_tenant, gp.user_id)),
        'xp', (SELECT o_xp FROM compute_user_level(p_tenant, gp.user_id)),
        'current_lives', gp.current_lives, 'is_restricted', gp.is_restricted,
        'is_banned', gp.is_banned, 'ban_reason', gp.ban_reason
      ) AS item
    FROM game_profiles gp JOIN profiles p ON p.id = gp.user_id
    WHERE gp.tenant = p_tenant
      AND (p_search IS NULL OR p_search = '' OR gp.nickname ILIKE '%' || p_search || '%'
        OR p.nombre ILIKE '%' || p_search || '%' OR p.apellido ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
  ) sub;
  RETURN jsonb_build_object('players', v_result);
END;
$$;


-- ── 6. start_quiz: guardas de baneo y vidas ───────────────────
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
    'subject_id', p_subject_id,
    'category_id', p_category_id,
    'question_count', v_take,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;
