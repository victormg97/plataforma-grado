-- ============================================================
-- Migration 120: Comunidad Estratégica (Slice 1) — Points audit
-- ============================================================
-- Creates:
--   1. game_point_events    — immutable audit log; source of truth
--                             for streak and future ranking.
--   2. game_is_accessible() — SECURITY DEFINER helper that combines
--                             game_settings + get_current_user_rol()
--                             into the single access rule used by RLS.
--
-- Events are only ever written by the SECURITY DEFINER RPCs
-- (streak/points engine in migration 121); the client cannot INSERT
-- directly, so the audit log is non-tamperable from the frontend.
-- ============================================================

-- ── 1. game_point_events ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_point_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant         TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type    game_action_type NOT NULL,
  -- May be 0 when the source is disabled (participation still recorded).
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  -- Origin reference (e.g. the daily question_id or a quiz_id).
  source_ref     TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Calendar date (America/Santiago) derived at insert time; used by
  -- the streak engine and for dedupe.
  occurred_date  DATE NOT NULL
);

CREATE INDEX idx_game_point_events_tenant ON game_point_events (tenant);
CREATE INDEX idx_game_point_events_user ON game_point_events (tenant, user_id);
CREATE INDEX idx_game_point_events_user_date ON game_point_events (tenant, user_id, occurred_date);

-- Idempotency for the daily question: at most one event per user per
-- daily question (Req. 2.7 / 5.7). source_ref = the day's question_id.
CREATE UNIQUE INDEX uq_game_point_events_daily
  ON game_point_events (tenant, user_id, action_type, source_ref)
  WHERE action_type = 'daily_question_answered';

ALTER TABLE game_point_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own events.
CREATE POLICY "game_point_events_select_own"
  ON game_point_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can read all events.
CREATE POLICY "game_point_events_select_admin"
  ON game_point_events FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');

-- No INSERT/UPDATE/DELETE policy: events are written only by the
-- SECURITY DEFINER points engine (migration 121).


-- ── 2. game_is_accessible ─────────────────────────────────────
-- Single source of the access rule, shared by RLS across the game
-- tables. Fail-safe: no settings row or game_enabled = false => false.
--   accessible =
--     game_enabled AND ( visibility = 'all_users'
--                        OR (visibility = 'admin_only' AND rol = 'admin') )
CREATE OR REPLACE FUNCTION game_is_accessible(p_tenant TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.game_enabled
             AND (
               s.game_visibility = 'all_users'
               OR (s.game_visibility = 'admin_only' AND get_current_user_rol() = 'admin')
             )
      FROM game_settings s
      WHERE s.tenant = p_tenant
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION game_is_accessible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION game_is_accessible(TEXT) TO authenticated;
