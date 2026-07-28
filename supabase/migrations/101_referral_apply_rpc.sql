-- ============================================================
-- Migration 101: Stored procedure for referral code application
-- Consolidates validation, duplicate check, period counts,
-- and usage insertion into a single DB round-trip.
-- ============================================================

CREATE OR REPLACE FUNCTION apply_referral_code(
  p_tenant TEXT,
  p_referred_user_id UUID,
  p_code TEXT,
  p_code_type TEXT  -- 'user' or 'discount'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_code_id UUID;
  v_discount_code_id UUID;
  v_referrer_monthly_count INT := 0;
  v_referrer_weekly_count INT := 0;
  v_referrer_quarterly_count INT := 0;
  v_now TIMESTAMPTZ := now();
  v_start_of_month TIMESTAMPTZ;
  v_start_of_week TIMESTAMPTZ;
  v_start_of_quarter TIMESTAMPTZ;
  v_rules JSONB;
  v_result JSONB;
BEGIN
  -- ── 1. Resolve the code ──
  IF p_code_type = 'user' THEN
    SELECT id INTO v_user_code_id
    FROM user_referral_codes
    WHERE code = p_code AND tenant = p_tenant;

    IF v_user_code_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND');
    END IF;

    -- Prevent self-referral
    IF EXISTS (
      SELECT 1 FROM user_referral_codes
      WHERE id = v_user_code_id AND user_id = p_referred_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'SELF_REFERRAL');
    END IF;

  ELSIF p_code_type = 'discount' THEN
    SELECT id INTO v_discount_code_id
    FROM discount_codes
    WHERE code = p_code
      AND tenant = p_tenant
      AND (
        CASE
          WHEN manual_override IS NOT NULL THEN manual_override
          ELSE is_active
            AND (start_date IS NULL OR start_date <= CURRENT_DATE)
            AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        END
      );

    IF v_discount_code_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_INVALID_OR_EXPIRED');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE_TYPE');
  END IF;

  -- ── 2. Check duplicate usage ──
  IF EXISTS (
    SELECT 1 FROM referral_usages
    WHERE tenant = p_tenant AND referred_user_id = p_referred_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED');
  END IF;

  -- ── 3. Calculate period counts for volume goals (only for user codes) ──
  IF v_user_code_id IS NOT NULL THEN
    v_start_of_month := date_trunc('month', v_now);
    v_start_of_week := date_trunc('week', v_now);
    v_start_of_quarter := date_trunc('quarter', v_now);

    SELECT count(*)::INT INTO v_referrer_monthly_count
    FROM referral_usages
    WHERE user_referral_code_id = v_user_code_id
      AND tenant = p_tenant
      AND used_at >= v_start_of_month;

    SELECT count(*)::INT INTO v_referrer_weekly_count
    FROM referral_usages
    WHERE user_referral_code_id = v_user_code_id
      AND tenant = p_tenant
      AND used_at >= v_start_of_week;

    SELECT count(*)::INT INTO v_referrer_quarterly_count
    FROM referral_usages
    WHERE user_referral_code_id = v_user_code_id
      AND tenant = p_tenant
      AND used_at >= v_start_of_quarter;
  END IF;

  -- ── 4. Get active reward rules ──
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
  INTO v_rules
  FROM referral_reward_rules r
  WHERE r.tenant = p_tenant AND r.is_active = true;

  -- ── 5. Insert the usage (rewards_applied will be updated by app layer) ──
  INSERT INTO referral_usages (
    tenant, referred_user_id, user_referral_code_id, discount_code_id, used_at, rewards_applied
  ) VALUES (
    p_tenant, p_referred_user_id, v_user_code_id, v_discount_code_id, v_now, '{}'::jsonb
  );

  -- ── 6. Return context for reward calculation ──
  v_result := jsonb_build_object(
    'success', true,
    'user_referral_code_id', v_user_code_id,
    'discount_code_id', v_discount_code_id,
    'referrer_monthly_count', v_referrer_monthly_count,
    'referrer_weekly_count', v_referrer_weekly_count,
    'referrer_quarterly_count', v_referrer_quarterly_count,
    'rules', v_rules
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- Stored procedure: assign_user_referral_code
-- Assigns a referral code to a user if they don't have one.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_user_referral_code(
  p_tenant TEXT,
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing TEXT;
BEGIN
  SELECT code INTO v_existing
  FROM user_referral_codes
  WHERE user_id = p_user_id AND tenant = p_tenant;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'code', v_existing, 'already_existed', true);
  END IF;

  BEGIN
    INSERT INTO user_referral_codes (user_id, tenant, code)
    VALUES (p_user_id, p_tenant, p_code);

    RETURN jsonb_build_object('success', true, 'code', p_code, 'already_existed', false);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_COLLISION');
  END;
END;
$$;
