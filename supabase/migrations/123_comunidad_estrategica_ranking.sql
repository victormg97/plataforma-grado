-- ============================================================
-- Migration 123: Comunidad Estratégica (Slice 2) — Ranking mensual
-- ============================================================
-- Creates:
--   1. get_monthly_ranking()     — paginated monthly ranking, derived by
--                                  aggregating game_point_events over the
--                                  calendar month (America/Santiago).
--   2. get_my_ranking_position() — caller's own position in the full month
--                                  ranking, even when outside the visible top.
--
-- The ranking is DERIVED by aggregation; it never resets/modifies/deletes
-- events (Req. 5.6 / 6.1). Deterministic tie-break: points DESC,
-- earliest event ASC, user_id ASC (Req. 5.7).
-- Display name: real name when game_settings.show_real_name, else nickname.
-- ============================================================

-- ── 1. get_monthly_ranking ────────────────────────────────────
-- p_month: any date within the target month; NULL = current month.
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
  v_month_start DATE;
  v_month_end   DATE;
  v_show_real   BOOLEAN;
  v_total       BIGINT;
  v_entries     JSONB;
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

  -- Aggregate points per user within the month (America/Santiago window).
  WITH monthly AS (
    SELECT
      e.user_id,
      SUM(e.points_awarded) AS points,
      MIN(e.occurred_at)    AS earliest_reach
    FROM game_point_events e
    WHERE e.tenant = p_tenant
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT
      m.user_id,
      m.points,
      ROW_NUMBER() OVER (
        ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC
      ) AS position
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
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT
      m.user_id,
      m.points,
      ROW_NUMBER() OVER (
        ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC
      ) AS position
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
      'nickname', gp.nickname
    ) ORDER BY r.position
  )
  INTO v_entries
  FROM ranked r
  LEFT JOIN game_profiles gp ON gp.user_id = r.user_id AND gp.tenant = p_tenant
  LEFT JOIN profiles p ON p.id = r.user_id
  WHERE r.position > p_offset
    AND r.position <= p_offset + p_limit;

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


-- ── 2. get_my_ranking_position ────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_ranking_position(
  p_tenant TEXT,
  p_month  DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_month_start DATE;
  v_month_end   DATE;
  v_position    BIGINT;
  v_points      BIGINT;
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

  WITH monthly AS (
    SELECT
      e.user_id,
      SUM(e.points_awarded) AS points,
      MIN(e.occurred_at)    AS earliest_reach
    FROM game_point_events e
    WHERE e.tenant = p_tenant
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT
      m.user_id,
      m.points,
      ROW_NUMBER() OVER (
        ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC
      ) AS position
    FROM monthly m
  )
  SELECT r.position, r.points INTO v_position, v_points
  FROM ranked r
  WHERE r.user_id = v_user_id;

  IF v_position IS NULL THEN
    RETURN jsonb_build_object('has_position', false);
  END IF;

  RETURN jsonb_build_object(
    'has_position', true,
    'position', v_position,
    'points', v_points
  );
END;
$$;

REVOKE ALL ON FUNCTION get_my_ranking_position(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_ranking_position(TEXT, DATE) TO authenticated;
