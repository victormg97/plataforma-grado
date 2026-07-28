-- ============================================================
-- Migration 100: Retroactive referral code assignment
-- ============================================================
-- Assigns a unique referral code to all existing profiles
-- for each tenant that has platform_enabled = true.
--
-- Pattern: {initial_nombre}{initial_apellido}-{4 alphanumeric}
-- Fallback: if apellido is empty, use initial of apellido_materno or 'X'.
--
-- Uses the same uniqueness and anti-word heuristic as the app-level
-- code generator (suffix with at least one digit preferred; pure-letter
-- 4-char suffixes are re-rolled to reduce word formation probability).
-- ============================================================

DO $$
DECLARE
  r               RECORD;
  v_tenant        TEXT;
  v_initial1      CHAR(1);
  v_initial2      CHAR(1);
  v_suffix        TEXT;
  v_code          TEXT;
  v_attempts      INT;
  -- Alphanumeric charset without ambiguous chars (I, O, 1, 0)
  v_charset       TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_charset_len   INT  := 32;
  v_char_idx      INT;
  v_is_all_alpha  BOOLEAN;
BEGIN
  -- Iterate over all tenants with platform_enabled = true
  FOR v_tenant IN
    SELECT tenant FROM referral_settings WHERE platform_enabled = true
  LOOP
    RAISE NOTICE 'Assigning referral codes for tenant: %', v_tenant;

    -- Iterate over all profiles that don't yet have a code for this tenant
    FOR r IN
      SELECT p.id, p.nombre, p.apellido, p.apellido_materno
      FROM profiles p
      WHERE NOT EXISTS (
        SELECT 1 FROM user_referral_codes urc
        WHERE urc.user_id = p.id AND urc.tenant = v_tenant
      )
    LOOP
      -- Build prefix from initials
      v_initial1 := upper(left(COALESCE(NULLIF(trim(r.nombre), ''), 'X'), 1));
      v_initial2 := COALESCE(
        NULLIF(upper(left(NULLIF(trim(r.apellido), ''), 1)), ''),
        NULLIF(upper(left(NULLIF(trim(r.apellido_materno), ''), 1)), ''),
        'X'
      );

      v_attempts := 0;

      LOOP
        -- Generate 4 random chars from charset
        v_suffix := '';
        v_is_all_alpha := true;

        FOR i IN 1..4 LOOP
          v_char_idx := floor(random() * v_charset_len)::INT + 1;
          v_suffix := v_suffix || substr(v_charset, v_char_idx, 1);
          -- Check if this char is a digit (positions 24-32 in charset are digits)
          IF substr(v_charset, v_char_idx, 1) ~ '[0-9]' THEN
            v_is_all_alpha := false;
          END IF;
        END LOOP;

        -- Prefer at least one digit on first 80 attempts (anti-word heuristic)
        IF v_attempts < 80 AND v_is_all_alpha THEN
          v_attempts := v_attempts + 1;
          CONTINUE;
        END IF;

        v_code := v_initial1 || v_initial2 || '-' || v_suffix;

        -- Attempt to insert; on conflict (duplicate code) retry
        BEGIN
          INSERT INTO user_referral_codes (user_id, tenant, code)
          VALUES (r.id, v_tenant, v_code);
          EXIT; -- success, move to next user
        EXCEPTION WHEN unique_violation THEN
          v_attempts := v_attempts + 1;
          IF v_attempts > 200 THEN
            RAISE WARNING 'Could not assign referral code to user % after 200 attempts. Skipping.', r.id;
            EXIT;
          END IF;
        END;
      END LOOP;
    END LOOP;

    RAISE NOTICE 'Completed referral code assignment for tenant: %', v_tenant;
  END LOOP;
END $$;
