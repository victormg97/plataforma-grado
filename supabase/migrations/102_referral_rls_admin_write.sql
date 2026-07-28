-- ============================================================
-- Migration 102: RLS policies for admin write access
-- Allows admin role to manage reward rules, insert usages,
-- and insert user referral codes via authenticated client.
-- ============================================================

-- Admin can CRUD reward rules
CREATE POLICY "referral_reward_rules_admin_all"
  ON referral_reward_rules FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');

-- Admin can insert usages (manual corrections)
CREATE POLICY "referral_usages_admin_insert"
  ON referral_usages FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_rol() = 'admin');

-- Admin can insert user referral codes (auto-generation via app)
CREATE POLICY "user_referral_codes_admin_insert"
  ON user_referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_rol() = 'admin');
