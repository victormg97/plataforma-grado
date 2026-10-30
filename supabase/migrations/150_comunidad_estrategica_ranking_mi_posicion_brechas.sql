-- 150: Ranking — my position with gaps for the redesigned ranking view.
--
-- get_my_ranking_position now:
--   * excludes restricted / banned players, same as get_monthly_ranking, so
--     the caller's position number matches the list;
--   * returns ahead_points (points of the player right above), podium_points
--     (points of 3rd place) and leader_points (points of 1st place), so the UI
--     can show "X pts to move up" without extra requests.
-- get_ranking_page already embeds it, so the call count is unchanged.

CREATE OR REPLACE FUNCTION public.get_my_ranking_position(p_tenant text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id      UUID := auth.uid();
  v_month_start  DATE;
  v_month_end    DATE;
  v_period_start TIMESTAMPTZ;
  v_result       JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('has_position', false);
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_month_start := date_trunc('month',
    COALESCE(p_month, (timezone('America/Santiago', now()))::date))::date;
  v_month_end := (v_month_start + INTERVAL '1 month')::date;

  SELECT started_at INTO v_period_start
  FROM game_score_periods
  WHERE tenant = p_tenant AND closed_at IS NULL
  ORDER BY started_at DESC LIMIT 1;
  v_period_start := COALESCE(v_period_start, '-infinity'::timestamptz);

  WITH monthly AS (
    SELECT e.user_id, SUM(e.points_awarded) AS points, MIN(e.occurred_at) AS earliest_reach
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
  ),
  me AS (
    SELECT r.position, r.points FROM ranked r WHERE r.user_id = v_user_id
  )
  SELECT jsonb_build_object(
    'has_position', true,
    'position', me.position,
    'points', me.points,
    'ahead_points', (SELECT r.points FROM ranked r WHERE r.position = me.position - 1),
    'podium_points', (SELECT r.points FROM ranked r WHERE r.position = 3),
    'leader_points', (SELECT r.points FROM ranked r WHERE r.position = 1)
  ) INTO v_result
  FROM me;

  RETURN COALESCE(v_result, jsonb_build_object('has_position', false));
END;
$function$;
