-- ============================================================
-- Migration 119: Comunidad Estratégica (Slice 1) — Player profile
-- ============================================================
-- Creates:
--   1. game_profiles           — 1:1 player profile per tenant
--                                (nickname + streak state)
--   2. upsert_game_nickname()  — SECURITY DEFINER RPC that
--                                encapsulates nickname validation,
--                                normalization, uniqueness and the
--                                configurable change cooldown.
--
-- Streak columns (current/longest/last_activity_date) are only
-- mutated by the server-side streak engine (migration 121), never
-- directly by the client.
-- ============================================================

-- Nickname character class: 3-20 chars, Latin letters incl. common
-- Spanish accents and ñ/ü, digits, hyphen and underscore.
-- Defined once here; the app mirrors it in lib/comunidad/nickname.ts.
--   allowed char = [A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ-]

CREATE TABLE IF NOT EXISTS game_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant               TEXT NOT NULL,
  -- Public nickname. NULL until the player completes onboarding.
  nickname             TEXT,
  -- lower(trim(nickname)) — used for case-insensitive uniqueness.
  nickname_normalized  TEXT,
  -- Timestamp of the last nickname change (base for cooldown checks).
  nickname_updated_at  TIMESTAMPTZ,
  current_streak       INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak       INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  -- Calendar date (America/Santiago) of the last streak-counting activity.
  last_activity_date   DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One profile per user per tenant.
  CONSTRAINT game_profiles_tenant_user_unique UNIQUE (tenant, user_id),
  -- Nickname unique (case-insensitive) within a tenant.
  CONSTRAINT game_profiles_tenant_nickname_unique UNIQUE (tenant, nickname_normalized),
  -- Format guard (length + allowed chars). NULL allowed pre-onboarding.
  CONSTRAINT game_profiles_nickname_format CHECK (
    nickname IS NULL
    OR nickname ~ '^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ-]{3,20}$'
  )
);

CREATE INDEX idx_game_profiles_tenant ON game_profiles (tenant);
CREATE INDEX idx_game_profiles_user ON game_profiles (user_id);

CREATE TRIGGER game_profiles_updated_at
  BEFORE UPDATE ON game_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile.
CREATE POLICY "game_profiles_select_own"
  ON game_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can read all profiles (admin view / support).
CREATE POLICY "game_profiles_select_admin"
  ON game_profiles FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');

-- NOTE: an additional accessibility-based SELECT policy for the future
-- ranking (Slice 2) is added in migration 121, after game_is_accessible()
-- exists (defined in migration 120).

-- No direct INSERT/UPDATE policy: writes happen through the
-- SECURITY DEFINER RPCs (upsert_game_nickname here; streak engine in 121).


-- ── RPC: upsert_game_nickname ─────────────────────────────────
-- Validates + normalizes the nickname, enforces the configurable
-- cooldown and case-insensitive uniqueness, and upserts the profile
-- row for the calling user. Returns a structured JSONB result so the
-- API can map error codes to localized messages.
CREATE OR REPLACE FUNCTION upsert_game_nickname(
  p_tenant   TEXT,
  p_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_trimmed       TEXT;
  v_normalized    TEXT;
  v_cooldown_days INTEGER;
  v_profile       game_profiles%ROWTYPE;
  v_next_allowed  TIMESTAMPTZ;
  v_days_left     INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Trim leading/trailing whitespace before validating (Req. 3.3).
  v_trimmed := btrim(p_nickname);

  -- Length + allowed characters (Req. 3.2).
  IF v_trimmed IS NULL
     OR char_length(v_trimmed) < 3
     OR char_length(v_trimmed) > 20
     OR v_trimmed !~ '^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ-]{3,20}$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_FORMAT');
  END IF;

  v_normalized := lower(v_trimmed);

  -- Read the tenant cooldown (fail-safe to 0 if no settings row).
  SELECT nickname_change_cooldown_days INTO v_cooldown_days
  FROM game_settings WHERE tenant = p_tenant;
  v_cooldown_days := COALESCE(v_cooldown_days, 0);

  -- Load existing profile (if any) for this user/tenant.
  SELECT * INTO v_profile
  FROM game_profiles
  WHERE tenant = p_tenant AND user_id = v_user_id;

  -- If the profile already has a nickname and this is an actual change,
  -- enforce the cooldown (Req. 3.7 / 3.8).
  IF FOUND
     AND v_profile.nickname IS NOT NULL
     AND v_profile.nickname_normalized IS DISTINCT FROM v_normalized THEN

    IF v_cooldown_days > 0 AND v_profile.nickname_updated_at IS NOT NULL THEN
      v_next_allowed := v_profile.nickname_updated_at + make_interval(days => v_cooldown_days);
      IF now() < v_next_allowed THEN
        v_days_left := CEIL(EXTRACT(EPOCH FROM (v_next_allowed - now())) / 86400.0);
        RETURN jsonb_build_object(
          'ok', false,
          'error_code', 'COOLDOWN_ACTIVE',
          'days_remaining', GREATEST(v_days_left, 1)
        );
      END IF;
    END IF;
  END IF;

  -- If the nickname is unchanged, no-op success (keeps current state).
  IF FOUND AND v_profile.nickname_normalized IS NOT DISTINCT FROM v_normalized THEN
    RETURN jsonb_build_object('ok', true, 'nickname', v_profile.nickname, 'unchanged', true);
  END IF;

  -- Upsert. The unique (tenant, nickname_normalized) constraint enforces
  -- case-insensitive uniqueness; a violation maps to NICKNAME_TAKEN.
  BEGIN
    INSERT INTO game_profiles (user_id, tenant, nickname, nickname_normalized, nickname_updated_at)
    VALUES (v_user_id, p_tenant, v_trimmed, v_normalized, now())
    ON CONFLICT (tenant, user_id)
    DO UPDATE SET
      nickname            = EXCLUDED.nickname,
      nickname_normalized = EXCLUDED.nickname_normalized,
      nickname_updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NICKNAME_TAKEN');
  END;

  RETURN jsonb_build_object('ok', true, 'nickname', v_trimmed);
END;
$$;

REVOKE ALL ON FUNCTION upsert_game_nickname(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_game_nickname(TEXT, TEXT) TO authenticated;
