-- ============================================================
-- Migration 118: Comunidad Estratégica (Slice 1) — Base
-- ============================================================
-- Creates the base infrastructure of the gamification feature
-- "Comunidad Estratégica":
--   1. Enums: game_visibility, game_action_type
--   2. game_settings          — per-tenant two-layer config
--   3. game_point_sources     — configurable points engine sources
--   4. game_streak_thresholds — 3/7/15/30 catalog (prepares Slice 3)
--
-- Follows the patterns of referral_settings (099) and the
-- question bank (104/107): tenant TEXT column, SELECT for
-- authenticated users, mutations via service role only.
-- Nothing tenant/role specific is hardcoded in business logic;
-- role is resolved via get_current_user_rol() (defined in 099).
-- ============================================================

-- ── 1. Enums ──────────────────────────────────────────────────

-- Visibility of the game within a tenant (only relevant when game_enabled = true)
CREATE TYPE game_visibility AS ENUM ('admin_only', 'all_users');

-- Extensible set of point-awarding action types. Only
-- 'daily_question_answered' emits events in Slice 1; the rest are
-- defined here (config-only) and wired up in later slices.
-- New values can be appended later via: ALTER TYPE game_action_type ADD VALUE ...
CREATE TYPE game_action_type AS ENUM (
  'quiz_completed',
  'daily_question_answered',
  'interrogacion_completed',
  'weekly_case_participated',
  'study_hours_logged'
);


-- ── 2. game_settings ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_settings (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant                         TEXT NOT NULL UNIQUE,
  -- Platform-level flag: controlled by the platform team via service role
  -- (SQL or platform admin API). Never mutated by tenant admins.
  game_enabled                   BOOLEAN NOT NULL DEFAULT false,
  -- Visibility layer, controlled by tenant admin (only relevant when enabled)
  game_visibility                game_visibility NOT NULL DEFAULT 'admin_only',
  -- Display name of the game (shown in sidebar / mini-app header)
  display_name                   TEXT NOT NULL DEFAULT 'Comunidad Estratégica',
  -- Cooldown (in days) between nickname changes
  nickname_change_cooldown_days  INTEGER NOT NULL DEFAULT 0 CHECK (nickname_change_cooldown_days >= 0),
  -- Configurable section names (some prepare Slices 2-4)
  section_name_daily_question    TEXT NOT NULL DEFAULT 'Pregunta del Día',
  section_name_streak            TEXT NOT NULL DEFAULT 'Racha',
  section_name_ranking           TEXT NOT NULL DEFAULT 'Ranking',
  section_name_challenges        TEXT NOT NULL DEFAULT 'Desafíos',
  section_name_badges            TEXT NOT NULL DEFAULT 'Insignias',
  section_name_weekly_case       TEXT NOT NULL DEFAULT 'Caso Semanal',
  -- Lucide-react icon name for the sidebar entry
  icon                           TEXT NOT NULL DEFAULT 'trophy',
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER game_settings_updated_at
  BEFORE UPDATE ON game_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read settings (sidebar gating, mini-app access check)
CREATE POLICY "game_settings_select_authenticated"
  ON game_settings FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE policy for authenticated: mutations go through the
-- service role (admin API route strips game_enabled before upserting).


-- ── 3. game_point_sources ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_point_sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant            TEXT NOT NULL,
  action_type       game_action_type NOT NULL,
  points_value      INTEGER NOT NULL DEFAULT 0 CHECK (points_value >= 0),
  enabled           BOOLEAN NOT NULL DEFAULT true,
  -- Whether this action counts towards the study streak (Req. 4.2:
  -- configurable, not a hardcoded rule).
  counts_for_streak BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_point_sources_tenant_action_unique UNIQUE (tenant, action_type)
);

CREATE INDEX idx_game_point_sources_tenant ON game_point_sources (tenant);

CREATE TRIGGER game_point_sources_updated_at
  BEFORE UPDATE ON game_point_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_point_sources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read sources (player view shows configured points)
CREATE POLICY "game_point_sources_select_authenticated"
  ON game_point_sources FOR SELECT
  TO authenticated
  USING (true);

-- Mutations via service role / admin API only.


-- ── 4. game_streak_thresholds (catalog, prepares Slice 3) ─────

CREATE TABLE IF NOT EXISTS game_streak_thresholds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant      TEXT NOT NULL,
  days        INTEGER NOT NULL CHECK (days > 0),
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_streak_thresholds_tenant_days_unique UNIQUE (tenant, days)
);

CREATE INDEX idx_game_streak_thresholds_tenant ON game_streak_thresholds (tenant);

ALTER TABLE game_streak_thresholds ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the catalog (player view / future badges)
CREATE POLICY "game_streak_thresholds_select_authenticated"
  ON game_streak_thresholds FOR SELECT
  TO authenticated
  USING (true);


-- ── 5. Seeds for tenant "pregunta-estrategica" ────────────────

-- Game enabled at platform level, restricted to admin during rollout.
INSERT INTO game_settings (tenant, game_enabled, game_visibility)
VALUES ('pregunta-estrategica', true, 'admin_only')
ON CONFLICT (tenant) DO NOTHING;

-- Point sources: only daily_question_answered active + counts for streak.
-- Others are defined (config-only) with enabled = false.
INSERT INTO game_point_sources (tenant, action_type, points_value, enabled, counts_for_streak)
VALUES
  ('pregunta-estrategica', 'daily_question_answered', 10, true,  true),
  ('pregunta-estrategica', 'quiz_completed',           0, false, false),
  ('pregunta-estrategica', 'interrogacion_completed',  0, false, false),
  ('pregunta-estrategica', 'weekly_case_participated',  0, false, false),
  ('pregunta-estrategica', 'study_hours_logged',        0, false, false)
ON CONFLICT (tenant, action_type) DO NOTHING;

-- Streak thresholds catalog (3/7/15/30) for future badges.
INSERT INTO game_streak_thresholds (tenant, days)
VALUES
  ('pregunta-estrategica', 3),
  ('pregunta-estrategica', 7),
  ('pregunta-estrategica', 15),
  ('pregunta-estrategica', 30)
ON CONFLICT (tenant, days) DO NOTHING;
