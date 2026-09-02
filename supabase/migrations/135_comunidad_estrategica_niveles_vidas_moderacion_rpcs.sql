-- Migration 135: Comunidad Estratégica — RPCs de Niveles, Vidas y Moderación
-- ============================================================
-- Añade:
--   1. compute_user_level()        — nivel por XP acumulado (desde xp_reset_at)
--   2. regen_and_get_lives()       — recarga perezosa de vidas (per_life/full_refill)
--   3. consume_life()              — descuenta una vida (interno)
--   4. get_game_profile()          — perfil extendido (streak+vidas+nivel+logros+moderación)
--   5. get_recent_achievements()   — últimas insignias del usuario (config N)
--   6. Rewire submit_quiz / answer_daily_question / submit_weekly_case_answer:
--        - rechazar usuarios baneados (PLAYER_BANNED)
--        - bloquear por falta de vidas si aplica (NO_LIVES)
--        - descontar vida al fallar si la fuente costs_life
--   7. get_monthly_ranking()       — excluir jugadores restringidos y baneados
--   8. Moderación admin: restrict_player / unrestrict_player / ban_player /
--        unban_player / set_player_lives / reset_player_level / list_game_players
-- Todo respeta game_is_accessible (jugador) y get_current_user_rol()='admin'.
-- ============================================================


-- ── 1. compute_user_level ─────────────────────────────────────
-- XP = SUM(points_awarded) de game_point_events del usuario con
-- occurred_at >= COALESCE(xp_reset_at, '-infinity'). El nivel es el mayor
-- cuyo min_points <= XP. Devuelve nivel, xp, umbral actual y siguiente.
CREATE OR REPLACE FUNCTION compute_user_level(p_tenant TEXT, p_user_id UUID)
RETURNS TABLE (o_level INTEGER, o_xp INTEGER, o_current_min INTEGER, o_next_min INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_at TIMESTAMPTZ;
  v_xp       INTEGER := 0;
BEGIN
  SELECT xp_reset_at INTO v_reset_at
  FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;

  SELECT COALESCE(SUM(points_awarded), 0) INTO v_xp
  FROM game_point_events
  WHERE tenant = p_tenant AND user_id = p_user_id
    AND occurred_at >= COALESCE(v_reset_at, '-infinity'::timestamptz);

  o_xp := v_xp;

  SELECT lt.level, lt.min_points
  INTO o_level, o_current_min
  FROM game_level_thresholds lt
  WHERE lt.tenant = p_tenant AND lt.min_points <= v_xp
  ORDER BY lt.min_points DESC, lt.level DESC
  LIMIT 1;

  IF o_level IS NULL THEN
    -- No thresholds configured or none reached: default level 1.
    o_level := 1;
    o_current_min := 0;
  END IF;

  SELECT lt.min_points INTO o_next_min
  FROM game_level_thresholds lt
  WHERE lt.tenant = p_tenant AND lt.level = o_level + 1;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION compute_user_level(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_user_level(TEXT, UUID) TO authenticated;


-- ── 2. regen_and_get_lives ────────────────────────────────────
-- Recarga perezosa según la config del tenant. Persiste el resultado.
-- Devuelve las vidas actuales, el máximo, y el instante de la próxima
-- recarga (NULL si ya está lleno o el sistema está deshabilitado).
CREATE OR REPLACE FUNCTION regen_and_get_lives(p_tenant TEXT, p_user_id UUID)
RETURNS TABLE (o_lives INTEGER, o_max INTEGER, o_enabled BOOLEAN, o_next_regen TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled    BOOLEAN;
  v_max        INTEGER;
  v_start      INTEGER;
  v_mode       game_lives_regen_mode;
  v_hours      NUMERIC;
  v_prof       game_profiles%ROWTYPE;
  v_now        TIMESTAMPTZ := now();
  v_interval   INTERVAL;
  v_elapsed    NUMERIC;
  v_gained     INTEGER;
  v_new_lives  INTEGER;
  v_anchor     TIMESTAMPTZ;
BEGIN
  SELECT lives_enabled, lives_max, lives_start, lives_regen_mode, lives_regen_hours
  INTO v_enabled, v_max, v_start, v_mode, v_hours
  FROM game_settings WHERE tenant = p_tenant;

  v_enabled := COALESCE(v_enabled, false);
  v_max     := COALESCE(v_max, 10);
  v_start   := COALESCE(v_start, v_max);
  v_hours   := COALESCE(v_hours, 1);

  -- Ensure a profile row exists.
  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  SELECT * INTO v_prof FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;

  IF NOT v_enabled THEN
    o_lives := COALESCE(v_prof.current_lives, v_start);
    o_max := v_max; o_enabled := false; o_next_regen := NULL;
    RETURN NEXT; RETURN;
  END IF;

  -- Initialize lives on first access.
  IF v_prof.current_lives IS NULL THEN
    v_new_lives := LEAST(v_start, v_max);
    UPDATE game_profiles
    SET current_lives = v_new_lives, lives_updated_at = v_now
    WHERE tenant = p_tenant AND user_id = p_user_id;
    o_lives := v_new_lives; o_max := v_max; o_enabled := true;
    o_next_regen := CASE WHEN v_new_lives >= v_max THEN NULL
                         ELSE v_now + make_interval(mins => (v_hours * 60)::int) END;
    RETURN NEXT; RETURN;
  END IF;

  -- Already full: nothing to regen.
  IF v_prof.current_lives >= v_max THEN
    o_lives := v_prof.current_lives; o_max := v_max; o_enabled := true; o_next_regen := NULL;
    RETURN NEXT; RETURN;
  END IF;

  v_interval := make_interval(mins => (v_hours * 60)::int);
  v_anchor := COALESCE(v_prof.lives_updated_at, v_now);
  v_elapsed := EXTRACT(EPOCH FROM (v_now - v_anchor)) / 3600.0;  -- hours

  IF v_mode = 'full_refill' THEN
    -- One full refill after v_hours since the anchor.
    IF v_elapsed >= v_hours THEN
      v_new_lives := v_max;
      UPDATE game_profiles SET current_lives = v_new_lives, lives_updated_at = v_now
      WHERE tenant = p_tenant AND user_id = p_user_id;
      o_lives := v_new_lives; o_next_regen := NULL;
    ELSE
      o_lives := v_prof.current_lives;
      o_next_regen := v_anchor + v_interval;
    END IF;
  ELSE
    -- per_life: gain floor(elapsed / hours) lives, advance the anchor.
    v_gained := FLOOR(v_elapsed / v_hours)::int;
    IF v_gained > 0 THEN
      v_new_lives := LEAST(v_prof.current_lives + v_gained, v_max);
      -- Advance anchor by the consumed whole intervals.
      v_anchor := v_anchor + (v_gained * v_interval);
      UPDATE game_profiles SET current_lives = v_new_lives, lives_updated_at = v_anchor
      WHERE tenant = p_tenant AND user_id = p_user_id;
      o_lives := v_new_lives;
    ELSE
      o_lives := v_prof.current_lives;
    END IF;
    o_next_regen := CASE WHEN o_lives >= v_max THEN NULL ELSE v_anchor + v_interval END;
  END IF;

  o_max := v_max; o_enabled := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION regen_and_get_lives(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION regen_and_get_lives(TEXT, UUID) TO authenticated;


-- ── 3. consume_life (interno) ─────────────────────────────────
-- Descuenta una vida (mínimo 0) si el sistema está habilitado. Ancla
-- lives_updated_at cuando se pasa de lleno a no-lleno (para iniciar el timer).
CREATE OR REPLACE FUNCTION consume_life(p_tenant TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_max     INTEGER;
  v_cur     INTEGER;
BEGIN
  SELECT lives_enabled, lives_max INTO v_enabled, v_max
  FROM game_settings WHERE tenant = p_tenant;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN;
  END IF;

  -- Make sure lives are up to date first.
  PERFORM regen_and_get_lives(p_tenant, p_user_id);

  SELECT current_lives INTO v_cur
  FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;

  IF v_cur IS NULL THEN
    RETURN;
  END IF;

  UPDATE game_profiles
  SET current_lives = GREATEST(v_cur - 1, 0),
      -- Start the regen timer when leaving the full state.
      lives_updated_at = CASE WHEN v_cur >= COALESCE(v_max, 10) THEN now() ELSE lives_updated_at END
  WHERE tenant = p_tenant AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION consume_life(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_life(TEXT, UUID) TO authenticated;


-- ── 4. player_has_life (interno) ──────────────────────────────
-- true si el jugador puede jugar según la config de vidas.
CREATE OR REPLACE FUNCTION player_has_life(p_tenant TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_block   BOOLEAN;
  v_lives   INTEGER;
BEGIN
  SELECT lives_enabled, lives_block_when_empty INTO v_enabled, v_block
  FROM game_settings WHERE tenant = p_tenant;

  IF NOT COALESCE(v_enabled, false) OR NOT COALESCE(v_block, true) THEN
    RETURN true;  -- lives disabled, or empty does not block
  END IF;

  SELECT o_lives INTO v_lives FROM regen_and_get_lives(p_tenant, p_user_id);
  RETURN COALESCE(v_lives, 0) > 0;
END;
$$;

REVOKE ALL ON FUNCTION player_has_life(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION player_has_life(TEXT, UUID) TO authenticated;


-- ── 5. player_is_banned (interno) ─────────────────────────────
CREATE OR REPLACE FUNCTION player_is_banned(p_tenant TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT is_banned FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id
  ), false);
$$;

REVOKE ALL ON FUNCTION player_is_banned(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION player_is_banned(TEXT, UUID) TO authenticated;


-- ── 6. get_recent_achievements ────────────────────────────────
CREATE OR REPLACE FUNCTION get_recent_achievements(p_tenant TEXT, p_limit INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit   INTEGER;
  v_result  JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL THEN
    SELECT recent_achievements_count INTO v_limit FROM game_settings WHERE tenant = p_tenant;
  ELSE
    v_limit := p_limit;
  END IF;
  v_limit := GREATEST(COALESCE(v_limit, 3), 1);

  SELECT COALESCE(jsonb_agg(item ORDER BY granted_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT ub.granted_at,
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'description', b.description,
        'image_path', b.image_path,
        'granted_at', ub.granted_at
      ) AS item
    FROM user_badges ub
    JOIN game_badges b ON b.id = ub.badge_id AND b.deleted_at IS NULL
    WHERE ub.tenant = p_tenant AND ub.user_id = v_user_id
    ORDER BY ub.granted_at DESC
    LIMIT v_limit
  ) sub;

  RETURN jsonb_build_object('achievements', v_result);
END;
$$;

REVOKE ALL ON FUNCTION get_recent_achievements(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_recent_achievements(TEXT, INTEGER) TO authenticated;


-- ── 7. get_game_profile ───────────────────────────────────────
-- Perfil extendido del jugador: nickname/streak + vidas (tras recarga) +
-- nivel + logros recientes + estado de moderación. Siembra vidas al primer
-- acceso. game_is_accessible requerido.
CREATE OR REPLACE FUNCTION get_game_profile(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_prof     game_profiles%ROWTYPE;
  v_lives    INTEGER; v_lmax INTEGER; v_lenabled BOOLEAN; v_next TIMESTAMPTZ;
  v_block    BOOLEAN;
  v_level    INTEGER; v_xp INTEGER; v_cur_min INTEGER; v_next_min INTEGER;
  v_recent   JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Lazy lives regen (also seeds a profile row + initial lives).
  SELECT o_lives, o_max, o_enabled, o_next_regen
  INTO v_lives, v_lmax, v_lenabled, v_next
  FROM regen_and_get_lives(p_tenant, v_user_id);

  SELECT COALESCE(lives_block_when_empty, true) INTO v_block
  FROM game_settings WHERE tenant = p_tenant;

  SELECT * INTO v_prof FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;

  SELECT o_level, o_xp, o_current_min, o_next_min
  INTO v_level, v_xp, v_cur_min, v_next_min
  FROM compute_user_level(p_tenant, v_user_id);

  v_recent := get_recent_achievements(p_tenant, NULL);

  RETURN jsonb_build_object(
    'nickname', v_prof.nickname,
    'current_streak', COALESCE(v_prof.current_streak, 0),
    'longest_streak', COALESCE(v_prof.longest_streak, 0),
    'last_activity_date', v_prof.last_activity_date,
    'nickname_updated_at', v_prof.nickname_updated_at,
    'lives', jsonb_build_object(
      'enabled', v_lenabled,
      'current', v_lives,
      'max', v_lmax,
      'next_regen', v_next,
      'block_when_empty', COALESCE(v_block, true)
    ),
    'level', jsonb_build_object(
      'level', v_level,
      'xp', v_xp,
      'current_min', v_cur_min,
      'next_min', v_next_min
    ),
    'moderation', jsonb_build_object(
      'is_restricted', COALESCE(v_prof.is_restricted, false),
      'is_banned', COALESCE(v_prof.is_banned, false),
      'ban_reason', v_prof.ban_reason
    ),
    'recent_achievements', COALESCE(v_recent -> 'achievements', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_game_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_game_profile(TEXT) TO authenticated;
