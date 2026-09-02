-- Migration 134: Comunidad Estratégica — Niveles, Vidas, Hero image,
-- Logros recientes y Moderación de jugadores (schema)
-- ============================================================
-- Todo configurable por el admin (nada en duro). Cubre:
--   1. Enum game_lives_regen_mode (per_life | full_refill)
--   2. game_settings: hero_image_path, recent_achievements_count,
--      y config de vidas (lives_enabled, lives_max, lives_start,
--      lives_block_when_empty, lives_regen_mode, lives_regen_hours)
--   3. game_point_sources.costs_life (qué acciones descuentan vida al fallar)
--   4. game_profiles: current_lives, lives_updated_at, xp_reset_at,
--      moderación (is_restricted / restricted_* , is_banned / banned_* / ban_reason)
--   5. Tabla game_level_thresholds (umbrales de nivel configurables por tenant)
--   6. Bucket de Storage 'game-hero' + política de lectura pública
-- ============================================================

-- ── 1. Enum de modo de recarga de vidas ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_lives_regen_mode') THEN
    CREATE TYPE game_lives_regen_mode AS ENUM ('per_life', 'full_refill');
  END IF;
END $$;


-- ── 2. Config nueva en game_settings ──────────────────────────
ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS hero_image_path          TEXT,
  ADD COLUMN IF NOT EXISTS recent_achievements_count INTEGER NOT NULL DEFAULT 3
    CHECK (recent_achievements_count > 0),
  -- Vidas (defaults: sistema opcional, 10 vidas, no puede jugar sin vidas,
  -- recarga 1 vida cada 1 hora).
  ADD COLUMN IF NOT EXISTS lives_enabled            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lives_max                INTEGER NOT NULL DEFAULT 10
    CHECK (lives_max > 0),
  ADD COLUMN IF NOT EXISTS lives_start              INTEGER NOT NULL DEFAULT 10
    CHECK (lives_start >= 0),
  ADD COLUMN IF NOT EXISTS lives_block_when_empty   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lives_regen_mode         game_lives_regen_mode NOT NULL DEFAULT 'per_life',
  ADD COLUMN IF NOT EXISTS lives_regen_hours        NUMERIC NOT NULL DEFAULT 1
    CHECK (lives_regen_hours > 0);


-- ── 3. Consumo de vida por acción (game_point_sources) ────────
-- Qué acciones descuentan una vida al fallar. Configurable por el admin.
ALTER TABLE game_point_sources
  ADD COLUMN IF NOT EXISTS costs_life BOOLEAN NOT NULL DEFAULT false;


-- ── 4. Estado por usuario en game_profiles ────────────────────
ALTER TABLE game_profiles
  -- Vidas (NULL current_lives => aún no inicializado; se siembra al primer acceso).
  ADD COLUMN IF NOT EXISTS current_lives    INTEGER,
  ADD COLUMN IF NOT EXISTS lives_updated_at TIMESTAMPTZ,
  -- Nivel: XP acumulado histórico; un reset por usuario ignora eventos previos.
  ADD COLUMN IF NOT EXISTS xp_reset_at      TIMESTAMPTZ,
  -- Moderación: restricción de visualización del mote.
  ADD COLUMN IF NOT EXISTS is_restricted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restricted_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Moderación: baneo del juego.
  ADD COLUMN IF NOT EXISTS is_banned        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ban_reason       TEXT;


-- ── 5. game_level_thresholds — umbrales de nivel configurables ─
-- Nivel N se alcanza con >= min_points XP acumulado (desde xp_reset_at).
-- Debe existir siempre el nivel 1 con min_points = 0.
CREATE TABLE IF NOT EXISTS game_level_thresholds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant      TEXT NOT NULL,
  level       INTEGER NOT NULL CHECK (level > 0),
  min_points  INTEGER NOT NULL CHECK (min_points >= 0),
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_level_thresholds_unique UNIQUE (tenant, level)
);

CREATE INDEX IF NOT EXISTS idx_game_level_thresholds_tenant
  ON game_level_thresholds (tenant, min_points);

CREATE TRIGGER game_level_thresholds_updated_at
  BEFORE UPDATE ON game_level_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_level_thresholds ENABLE ROW LEVEL SECURITY;

-- Readable by users with access to the game (needed to render level labels).
CREATE POLICY "game_level_thresholds_select_accessible"
  ON game_level_thresholds FOR SELECT
  TO authenticated
  USING (game_is_accessible(tenant));

-- No client INSERT/UPDATE/DELETE: admin CRUD via service role / admin API.


-- ── 6. Seed de niveles por defecto para el tenant activo ──────
-- Curva de ejemplo editable por el admin: niveles 1..10.
INSERT INTO game_level_thresholds (tenant, level, min_points)
SELECT 'pregunta-estrategica', lvl, pts
FROM (VALUES
  (1, 0), (2, 100), (3, 250), (4, 450), (5, 700),
  (6, 1000), (7, 1400), (8, 1900), (9, 2500), (10, 3200)
) AS seed(lvl, pts)
WHERE NOT EXISTS (
  SELECT 1 FROM game_level_thresholds WHERE tenant = 'pregunta-estrategica'
);


-- ── 7. Bucket de Storage para la imagen del hero ──────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-hero', 'game-hero', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; writes go through the service role (createAdminClient) which
-- bypasses RLS, so no authenticated write policy is defined.
CREATE POLICY "game_hero_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'game-hero');
