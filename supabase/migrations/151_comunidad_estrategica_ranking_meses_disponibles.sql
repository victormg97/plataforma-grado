-- 151: Ranking — months with data, for the game's own month picker.
--
-- get_ranking_page now also returns available_months (only on the first page,
-- p_offset = 0): the 'YYYY-MM' months that have ranking points in the current
-- score period, newest first, always including the current month. Same
-- filters as get_monthly_ranking (score period start, restricted/banned
-- players excluded, months with a positive total), so every listed month
-- actually shows a ranking. Still one request per page.

CREATE OR REPLACE FUNCTION public.get_ranking_page(p_tenant text, p_month date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ranking      JSONB;
  v_pos          JSONB;
  v_months       JSONB;
  v_period_start TIMESTAMPTZ;
  v_current      TEXT := to_char(timezone('America/Santiago', now()), 'YYYY-MM');
BEGIN
  -- Access check happens inside get_monthly_ranking.
  v_ranking := get_monthly_ranking(p_tenant, p_month, p_limit, p_offset);
  v_pos := get_my_ranking_position(p_tenant, p_month);

  IF COALESCE(p_offset, 0) = 0 THEN
    SELECT started_at INTO v_period_start
    FROM game_score_periods
    WHERE tenant = p_tenant AND closed_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
    v_period_start := COALESCE(v_period_start, '-infinity'::timestamptz);

    WITH months AS (
      SELECT to_char(timezone('America/Santiago', e.occurred_at), 'YYYY-MM') AS m
      FROM game_point_events e
      WHERE e.tenant = p_tenant
        AND e.occurred_at >= v_period_start
        AND NOT EXISTS (
          SELECT 1 FROM game_profiles gp
          WHERE gp.tenant = p_tenant AND gp.user_id = e.user_id
            AND (gp.is_restricted = true OR gp.is_banned = true)
        )
      GROUP BY 1
      HAVING SUM(e.points_awarded) > 0
      UNION
      SELECT v_current
    )
    SELECT jsonb_agg(m ORDER BY m DESC) INTO v_months FROM months;
  END IF;

  RETURN COALESCE(v_ranking, '{}'::jsonb)
    || jsonb_build_object('my_position', COALESCE(v_pos, jsonb_build_object('has_position', false)))
    || CASE WHEN v_months IS NOT NULL THEN jsonb_build_object('available_months', v_months) ELSE '{}'::jsonb END;
END;
$function$;
