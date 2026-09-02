-- ============================================================
-- Migration 127: Comunidad Estratégica (Slice 3) — Estadísticas
-- ============================================================
-- get_game_stats(): admin-only aggregation dashboard (Req. 15). All
-- computed by aggregation over already-recorded data, in America/Santiago,
-- without modifying game_point_events or user_badges. Returns zeros when
-- there is no data (no error).
-- ============================================================

CREATE OR REPLACE FUNCTION get_game_stats(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := (timezone('America/Santiago', now()))::date;
  v_week_start  DATE := date_trunc('week', v_today)::date;   -- Monday
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

  -- Active users by window (distinct users with an event in the window).
  SELECT count(DISTINCT user_id) INTO v_dau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date = v_today;

  SELECT count(DISTINCT user_id) INTO v_wau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date >= v_week_start;

  SELECT count(DISTINCT user_id) INTO v_mau
  FROM game_point_events
  WHERE tenant = p_tenant AND (timezone('America/Santiago', occurred_at))::date >= v_month_start;

  -- Quizzes completed (all-time count of quiz_completed events).
  SELECT count(*) INTO v_quizzes
  FROM game_point_events
  WHERE tenant = p_tenant AND action_type = 'quiz_completed';

  -- Daily-question participation today: respondents vs. players that ever
  -- had a game profile (proxy for the eligible audience of this tenant).
  SELECT count(DISTINCT user_id) INTO v_daily_resp
  FROM game_point_events
  WHERE tenant = p_tenant AND action_type = 'daily_question_answered'
    AND (timezone('America/Santiago', occurred_at))::date = v_today;

  SELECT count(*) INTO v_accessible
  FROM game_profiles WHERE tenant = p_tenant;

  -- Active-streak distribution buckets.
  SELECT jsonb_build_object(
    'none',      count(*) FILTER (WHERE current_streak = 0),
    'from_1_2',  count(*) FILTER (WHERE current_streak BETWEEN 1 AND 2),
    'from_3_6',  count(*) FILTER (WHERE current_streak BETWEEN 3 AND 6),
    'from_7_14', count(*) FILTER (WHERE current_streak BETWEEN 7 AND 14),
    'from_15_29',count(*) FILTER (WHERE current_streak BETWEEN 15 AND 29),
    'from_30',   count(*) FILTER (WHERE current_streak >= 30)
  ) INTO v_streak_dist
  FROM game_profiles WHERE tenant = p_tenant;

  -- Current-month ranking preview (top 5), display name = nickname.
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

  -- Most-unlocked badges (top 5).
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

  -- Least-unlocked among enabled badges (includes zero-grant badges).
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

REVOKE ALL ON FUNCTION get_game_stats(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_game_stats(TEXT) TO authenticated;
