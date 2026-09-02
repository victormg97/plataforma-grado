-- ============================================================
-- Migration 128: Comunidad Estratégica (Slice 3) — Reinicio de puntajes
-- ============================================================
-- Non-destructive score reset via period close/archive (Req. 16-17):
--   1. Enum game_score_reset_scope
--   2. game_score_periods    — one open period per tenant (partial unique)
--   3. game_score_reset_log  — audit of each reset (admin-only reads)
--   4. game_point_events.score_period_id — links events to a period
--   5. Base period seed for pregunta-estrategica
--   6. reset_game_scores()   — close current period + open a new one,
--        record the audit log, never delete/modify events (Req. 16.3)
--   7. get_monthly_ranking / get_my_ranking_position re-created to
--        exclude events before the open period start (Req. 16.5)
--
-- All calendar boundaries use America/Santiago.
-- ============================================================

-- ── 1. Enum ───────────────────────────────────────────────────

CREATE TYPE game_score_reset_scope AS ENUM ('current-month-ranking-only', 'full-history-archive');


-- ── 2. game_score_periods ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_score_periods (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant     TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  closed_at  TIMESTAMPTZ,       -- NULL = current open period
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open period per tenant.
CREATE UNIQUE INDEX uq_game_score_periods_open
  ON game_score_periods (tenant) WHERE closed_at IS NULL;

CREATE INDEX idx_game_score_periods_tenant ON game_score_periods (tenant);

ALTER TABLE game_score_periods ENABLE ROW LEVEL SECURITY;

-- Readable by users with access to the game (ranking needs the open start).
CREATE POLICY "game_score_periods_select_accessible"
  ON game_score_periods FOR SELECT
  TO authenticated
  USING (game_is_accessible(tenant));


-- ── 3. game_score_reset_log ───────────────────────────────────

CREATE TABLE IF NOT EXISTS game_score_reset_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant           TEXT NOT NULL,
  executed_by      UUID NOT NULL REFERENCES profiles(id),
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_scope      game_score_reset_scope NOT NULL,
  closed_period_id UUID REFERENCES game_score_periods(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_score_reset_log_tenant ON game_score_reset_log (tenant, executed_at DESC);

ALTER TABLE game_score_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_score_reset_log_select_admin"
  ON game_score_reset_log FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');


-- ── 4. game_point_events.score_period_id ──────────────────────

ALTER TABLE game_point_events
  ADD COLUMN IF NOT EXISTS score_period_id UUID REFERENCES game_score_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_point_events_period
  ON game_point_events (tenant, score_period_id);


-- ── 5. Base period seed for the active tenant ─────────────────
-- Opens a base period so the ranking floor is well-defined. Events prior to
-- this remain (NULL score_period_id) and are treated as the base period.
INSERT INTO game_score_periods (tenant, started_at)
SELECT 'pregunta-estrategica', '-infinity'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM game_score_periods WHERE tenant = 'pregunta-estrategica' AND closed_at IS NULL
);


-- ── 6. reset_game_scores ──────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_game_scores(
  p_tenant       TEXT,
  p_scope        game_score_reset_scope,
  p_confirmation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         TIMESTAMPTZ := timezone('America/Santiago', now());
  v_open        game_score_periods%ROWTYPE;
  v_new_id      UUID;
  v_closed_id   UUID;
BEGIN
  -- Admin only (Req. 16.6/16.7).
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Exact confirmation required (Req. 17.1/17.2). Expected text = tenant id.
  IF p_confirmation IS DISTINCT FROM p_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFIRMATION_MISMATCH');
  END IF;

  -- Close the current open period (create one first if missing).
  SELECT * INTO v_open
  FROM game_score_periods
  WHERE tenant = p_tenant AND closed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO game_score_periods (tenant, started_at)
    VALUES (p_tenant, '-infinity'::timestamptz)
    RETURNING * INTO v_open;
  END IF;

  UPDATE game_score_periods
  SET closed_at = now()
  WHERE id = v_open.id
  RETURNING id INTO v_closed_id;

  -- full-history-archive: stamp all still-unassigned events of this tenant
  -- with the closed period id, archiving the accumulated history.
  IF p_scope = 'full-history-archive' THEN
    UPDATE game_point_events
    SET score_period_id = v_closed_id
    WHERE tenant = p_tenant AND score_period_id IS NULL;
  END IF;

  -- Open a new current period.
  INSERT INTO game_score_periods (tenant, started_at)
  VALUES (p_tenant, now())
  RETURNING id INTO v_new_id;

  -- Audit log (Req. 16.4).
  INSERT INTO game_score_reset_log (tenant, executed_by, executed_at, reset_scope, closed_period_id)
  VALUES (p_tenant, auth.uid(), now(), p_scope, v_closed_id);

  RETURN jsonb_build_object('ok', true, 'new_period_id', v_new_id, 'closed_period_id', v_closed_id);
END;
$$;

REVOKE ALL ON FUNCTION reset_game_scores(TEXT, game_score_reset_scope, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_game_scores(TEXT, game_score_reset_scope, TEXT) TO authenticated;


-- ── 7. Ranking RPCs re-scoped to the open period (Req. 16.5) ──
-- Adds a period floor: only events on/after the open period's started_at
-- count. Historical months remain queryable via p_month within that floor.

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

  -- Floor from the current open period (Req. 16.5).
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
      'nickname', gp.nickname
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
  v_user_id      UUID := auth.uid();
  v_month_start  DATE;
  v_month_end    DATE;
  v_position     BIGINT;
  v_points       BIGINT;
  v_period_start TIMESTAMPTZ;
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
    SELECT
      e.user_id,
      SUM(e.points_awarded) AS points,
      MIN(e.occurred_at)    AS earliest_reach
    FROM game_point_events e
    WHERE e.tenant = p_tenant
      AND e.occurred_at >= v_period_start
      AND (timezone('America/Santiago', e.occurred_at))::date >= v_month_start
      AND (timezone('America/Santiago', e.occurred_at))::date <  v_month_end
    GROUP BY e.user_id
    HAVING SUM(e.points_awarded) > 0
  ),
  ranked AS (
    SELECT m.user_id, m.points,
      ROW_NUMBER() OVER (ORDER BY m.points DESC, m.earliest_reach ASC, m.user_id ASC) AS position
    FROM monthly m
  )
  SELECT r.position, r.points INTO v_position, v_points
  FROM ranked r WHERE r.user_id = v_user_id;

  IF v_position IS NULL THEN
    RETURN jsonb_build_object('has_position', false);
  END IF;

  RETURN jsonb_build_object('has_position', true, 'position', v_position, 'points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION get_my_ranking_position(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_ranking_position(TEXT, DATE) TO authenticated;
