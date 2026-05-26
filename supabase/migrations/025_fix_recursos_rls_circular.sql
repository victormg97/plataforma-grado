-- =============================================================
-- 025_fix_recursos_rls_circular.sql
-- Breaks the circular RLS dependency between recursos_compartidos
-- and recursos_acceso by introducing a SECURITY DEFINER helper.
--
-- The cycle was:
--   recursos_compartidos alumno-policy
--     → EXISTS on recursos_acceso
--         → recursos_acceso profesor-policy
--             → EXISTS on recursos_compartidos  ← LOOP
--
-- Fix: replace the circular EXISTS in recursos_acceso with a
-- SECURITY DEFINER function that reads recursos_compartidos
-- bypassing RLS entirely.
-- =============================================================

-- -------------------------------------------------------
-- 1. Helper: check if current user owns a given resource
--    SECURITY DEFINER → skips RLS on recursos_compartidos
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION is_own_recurso(p_recurso_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recursos_compartidos
    WHERE id = p_recurso_id
      AND subido_por = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_own_recurso(UUID) TO authenticated;

-- -------------------------------------------------------
-- 2. Recreate recursos_acceso policies using the helper
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin: full access recursos_acceso"   ON recursos_acceso;
DROP POLICY IF EXISTS "profesor: manage acceso own recursos" ON recursos_acceso;
DROP POLICY IF EXISTS "alumno: select own accesos"           ON recursos_acceso;

-- ADMIN: full access
CREATE POLICY "admin: full access recursos_acceso"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING      (get_user_rol() = 'admin')
  WITH CHECK (get_user_rol() = 'admin');

-- PROFESOR: manage acceso records only for resources they uploaded
--   Uses is_own_recurso() to avoid querying recursos_compartidos
--   from within an RLS policy (would create circular recursion).
CREATE POLICY "profesor: manage acceso own recursos"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND is_own_recurso(recurso_id)
  )
  WITH CHECK (
    get_user_rol() = 'profesor'
    AND is_own_recurso(recurso_id)
  );

-- ALUMNO: read own access grants only
CREATE POLICY "alumno: select own accesos"
  ON recursos_acceso
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'alumno'
    AND alumno_id = auth.uid()
  );
