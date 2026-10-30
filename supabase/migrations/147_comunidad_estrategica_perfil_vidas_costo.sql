-- ============================================================
-- Migration 147: Comunidad Estratégica — perfil: ¿fallar cuesta vida?
-- ============================================================
-- get_game_profile agrega lives.costs_on_mistake: true si alguna fuente de
-- puntos habilitada tiene costs_life. La UI sólo muestra "fallar puede
-- costarte una vida" cuando es verdad (antes lo decía siempre, aunque ninguna
-- acción descontara vidas).
-- ============================================================

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
  v_costs    BOOLEAN;
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

  SELECT EXISTS (
    SELECT 1 FROM game_point_sources
    WHERE tenant = p_tenant AND enabled AND costs_life
  ) INTO v_costs;

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
    'previous_streak', CASE WHEN v_broken THEN v_stored ELSE COALESCE(v_prof.previous_streak, 0) END,
    'streak_status', v_status,
    'last_activity_date', v_prof.last_activity_date,
    'nickname_updated_at', v_prof.nickname_updated_at,
    'lives', jsonb_build_object(
      'enabled', v_lenabled, 'current', v_lives, 'max', v_lmax, 'next_regen', v_next,
      'block_when_empty', COALESCE(v_block, true),
      'costs_on_mistake', COALESCE(v_costs, false)
    ),
    'level', jsonb_build_object('level', v_level, 'xp', v_xp, 'current_min', v_cur_min, 'next_min', v_next_min),
    'moderation', jsonb_build_object('is_restricted', COALESCE(v_prof.is_restricted, false), 'is_banned', COALESCE(v_prof.is_banned, false), 'ban_reason', v_prof.ban_reason),
    'recent_achievements', COALESCE(v_recent -> 'achievements', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_game_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_game_profile(TEXT) TO authenticated;
