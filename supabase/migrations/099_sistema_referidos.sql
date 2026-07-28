-- ============================================================
-- Migration 099: Sistema de Referidos / "Código Estratégico"
-- ============================================================
-- Creates:
--   1. referral_settings       — per-tenant configuration
--   2. referral_reward_rules   — configurable rewards engine
--   3. user_referral_codes     — one code per user per tenant
--   4. discount_codes          — admin-created promo codes
--   5. referral_usages         — usage tracking + audit log
-- Note: lector was already added to user_rol enum in migration 075.
-- Code assignment is done at the application level (not via DB trigger)
-- because tenant context is not available at profile INSERT time.
-- ============================================================

-- ── 1. referral_settings ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_settings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant                          TEXT NOT NULL UNIQUE,
  -- Platform-level flag: controlled by platform team via SQL only.
  -- When false, the entire referral section is hidden from admin UI.
  platform_enabled                BOOLEAN NOT NULL DEFAULT false,
  -- Tenant-level flag: admin can toggle without hiding the config section.
  tenant_enabled                  BOOLEAN NOT NULL DEFAULT false,
  -- Display name shown to all users (e.g. "Código Estratégico")
  display_name                    TEXT NOT NULL DEFAULT 'Sistema de Referidos',
  -- Lucide-react icon name for the sidebar/button
  icon                            TEXT NOT NULL DEFAULT 'gift',
  -- Whether lector role users have access to the referral system
  reader_role_enabled             BOOLEAN NOT NULL DEFAULT true,
  -- Whether the admin-created discount codes module is enabled
  discount_codes_module_enabled   BOOLEAN NOT NULL DEFAULT false,
  -- Display name for the discount codes sub-module
  discount_codes_display_name     TEXT NOT NULL DEFAULT 'Códigos de Descuento',
  -- Controls what alumno/lector users see in their view
  show_rewards_to_user            BOOLEAN NOT NULL DEFAULT true,
  show_referral_count_to_user     BOOLEAN NOT NULL DEFAULT true,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: enable for "Pregunta Estratégica" tenant
INSERT INTO referral_settings (
  tenant,
  platform_enabled,
  tenant_enabled,
  display_name,
  icon,
  reader_role_enabled,
  discount_codes_module_enabled,
  discount_codes_display_name
) VALUES (
  'pregunta-estrategica',
  true,
  true,
  'Código Estratégico',
  'gift',
  true,
  false,
  'Códigos de Descuento'
) ON CONFLICT (tenant) DO NOTHING;

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER referral_settings_updated_at
  BEFORE UPDATE ON referral_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read settings (needed for sidebar, registration form)
CREATE POLICY "referral_settings_select_authenticated"
  ON referral_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (platform team controls platform_enabled)
-- App API routes use service role key for mutations.


-- ── 2. referral_reward_rules ──────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_reward_rules (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant                    TEXT NOT NULL,
  -- 'referred_new': reward for the new user who registered
  -- 'referrer'    : reward for the user who shared the code
  -- 'volume_goal' : bonus when referrer hits a referral milestone
  rule_type                 TEXT NOT NULL CHECK (rule_type IN ('referred_new', 'referrer', 'volume_goal')),
  -- 'fixed_amount': monetary discount
  -- 'percentage'  : percentage discount
  -- 'free_session': free class/session
  -- 'custom'      : described in volume_reward_description
  reward_type               TEXT NOT NULL CHECK (reward_type IN ('fixed_amount', 'percentage', 'free_session', 'custom')),
  reward_value              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- How many billing cycles/months the reward applies
  duration_cycles           INTEGER NOT NULL DEFAULT 1,
  -- Size of one "pack" (e.g., pack of 5 interrogaciones)
  pack_size                 INTEGER NOT NULL DEFAULT 1,
  -- Maximum discount cap per cycle (0 = no cap)
  max_discount_per_cycle    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- For rule_type = 'volume_goal': number of referrals needed to trigger bonus
  volume_target             INTEGER,
  -- Period for counting referrals: 'weekly', 'monthly', 'quarterly'
  volume_period             TEXT CHECK (volume_period IN ('weekly', 'monthly', 'quarterly')),
  -- Free-text description of the volume goal reward (e.g. "Sesión gratuita")
  volume_reward_description TEXT,
  -- Display order in admin UI
  sort_order                INTEGER NOT NULL DEFAULT 0,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_reward_rules_tenant ON referral_reward_rules (tenant);

CREATE TRIGGER referral_reward_rules_updated_at
  BEFORE UPDATE ON referral_reward_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE referral_reward_rules ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read rules (needed for reward preview in user views)
CREATE POLICY "referral_reward_rules_select_authenticated"
  ON referral_reward_rules FOR SELECT
  TO authenticated
  USING (true);


-- ── 3. user_referral_codes ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_referral_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant      TEXT NOT NULL,
  -- Pattern: "XX-YYYY" (e.g. "VM-9JK2")
  code        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One code per user per tenant
  CONSTRAINT user_referral_codes_tenant_user_unique UNIQUE (tenant, user_id),
  -- Codes are globally unique within a tenant
  CONSTRAINT user_referral_codes_tenant_code_unique UNIQUE (tenant, code),
  -- Validate code format: 2 uppercase letters + dash + 4 uppercase alphanumeric
  CONSTRAINT user_referral_codes_format CHECK (code ~ '^[A-Z]{2}-[A-Z0-9]{4}$')
);

CREATE INDEX idx_user_referral_codes_tenant ON user_referral_codes (tenant);
CREATE INDEX idx_user_referral_codes_user_id ON user_referral_codes (user_id);

ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;

-- Users can read their own code
CREATE POLICY "user_referral_codes_select_own"
  ON user_referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins and profesores can read all codes (needed for admin view and profesor view)
-- We use a SECURITY DEFINER function to avoid RLS recursion on profiles
CREATE OR REPLACE FUNCTION get_current_user_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol::TEXT FROM profiles WHERE id = auth.uid();
$$;

CREATE POLICY "user_referral_codes_select_admin_profesor"
  ON user_referral_codes FOR SELECT
  TO authenticated
  USING (get_current_user_rol() IN ('admin', 'profesor'));


-- ── 4. discount_codes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant          TEXT NOT NULL,
  -- Exactly 6 uppercase alphanumeric characters
  code            TEXT NOT NULL,
  -- Optional validity window
  start_date      DATE,
  end_date        DATE,
  -- Base active state
  is_active       BOOLEAN NOT NULL DEFAULT true,
  -- NULL = auto (computed from dates); TRUE/FALSE = manual admin override
  manual_override BOOLEAN,
  -- Optional reward rule for this specific discount code
  reward_rule_id  UUID REFERENCES referral_reward_rules(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_tenant_code_unique UNIQUE (tenant, code),
  CONSTRAINT discount_codes_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

CREATE INDEX idx_discount_codes_tenant ON discount_codes (tenant);

CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Admin can manage discount codes
CREATE POLICY "discount_codes_admin_all"
  ON discount_codes FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');

-- Public SELECT on active codes needed for validation during registration
-- (unauthenticated users completing the registration form need to validate)
-- We restrict to only the minimum needed: code + tenant + date fields
CREATE POLICY "discount_codes_select_for_validation"
  ON discount_codes FOR SELECT
  TO anon
  USING (true);


-- ── 5. referral_usages ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_usages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant                  TEXT NOT NULL,
  -- The newly registered user who used the code
  referred_user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Exactly one of these must be set (the code that was used)
  user_referral_code_id   UUID REFERENCES user_referral_codes(id) ON DELETE SET NULL,
  discount_code_id        UUID REFERENCES discount_codes(id) ON DELETE SET NULL,
  used_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- JSON snapshot of rewards that were applied (for audit; calculated by rewardEngine.ts)
  rewards_applied         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Exactly one code type must be specified
  CONSTRAINT referral_usages_one_code_type CHECK (
    (user_referral_code_id IS NOT NULL AND discount_code_id IS NULL) OR
    (user_referral_code_id IS NULL AND discount_code_id IS NOT NULL)
  ),
  -- A user can only use one referral code (one registration per user)
  CONSTRAINT referral_usages_one_per_user UNIQUE (tenant, referred_user_id)
);

CREATE INDEX idx_referral_usages_tenant ON referral_usages (tenant);
CREATE INDEX idx_referral_usages_referred_user ON referral_usages (referred_user_id);
CREATE INDEX idx_referral_usages_user_code ON referral_usages (user_referral_code_id);
CREATE INDEX idx_referral_usages_discount_code ON referral_usages (discount_code_id);

ALTER TABLE referral_usages ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (to see their rewards)
CREATE POLICY "referral_usages_select_own"
  ON referral_usages FOR SELECT
  TO authenticated
  USING (referred_user_id = auth.uid());

-- Admin can read all usages
CREATE POLICY "referral_usages_select_admin"
  ON referral_usages FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');
