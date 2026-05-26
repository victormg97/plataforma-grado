-- =============================================================
-- 024_fix_recursos_rls_recursion.sql
-- Fixes infinite recursion in recursos_compartidos / recursos_acceso
-- RLS policies by replacing inline profile subqueries with the
-- existing SECURITY DEFINER function get_user_rol().
--
-- Root cause: policies were doing
--   (SELECT rol FROM profiles WHERE id = auth.uid())
-- which triggers RLS on profiles → can chain back → infinite loop.
-- Fix: use get_user_rol() which is SECURITY DEFINER and bypasses RLS.
-- =============================================================

-- -------------------------------------------------------
-- recursos_compartidos — drop and recreate all policies
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin: full access recursos_compartidos" ON recursos_compartidos;
DROP POLICY IF EXISTS "profesor: select own recursos"           ON recursos_compartidos;
DROP POLICY IF EXISTS "profesor: insert own recurso"           ON recursos_compartidos;
DROP POLICY IF EXISTS "profesor: update own recurso"           ON recursos_compartidos;
DROP POLICY IF EXISTS "profesor: delete own recurso"           ON recursos_compartidos;
DROP POLICY IF EXISTS "alumno: select accessible recursos"     ON recursos_compartidos;

-- ADMIN: full access
CREATE POLICY "admin: full access recursos_compartidos"
  ON recursos_compartidos
  FOR ALL
  TO authenticated
  USING      (get_user_rol() = 'admin')
  WITH CHECK (get_user_rol() = 'admin');

-- PROFESOR: select own resources
CREATE POLICY "profesor: select own recursos"
  ON recursos_compartidos
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND subido_por = auth.uid()
  );

-- PROFESOR: insert own resource
CREATE POLICY "profesor: insert own recurso"
  ON recursos_compartidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_rol() = 'profesor'
    AND subido_por = auth.uid()
  );

-- PROFESOR: update own resource
CREATE POLICY "profesor: update own recurso"
  ON recursos_compartidos
  FOR UPDATE
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND subido_por = auth.uid()
  )
  WITH CHECK (subido_por = auth.uid());

-- PROFESOR: delete own resource
CREATE POLICY "profesor: delete own recurso"
  ON recursos_compartidos
  FOR DELETE
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND subido_por = auth.uid()
  );

-- ALUMNO: read resources granted or para_todos
CREATE POLICY "alumno: select accessible recursos"
  ON recursos_compartidos
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'alumno'
    AND (
      -- Explicitly granted via recursos_acceso
      EXISTS (
        SELECT 1 FROM recursos_acceso ra
        WHERE ra.recurso_id = recursos_compartidos.id
          AND ra.alumno_id = auth.uid()
      )
      -- Global admin resource (para_todos)
      OR (para_todos = true AND subido_por IN (
          SELECT id FROM profiles WHERE rol = 'admin'
      ))
      -- Profesor's para_todos where alumno is assigned to that profesor
      OR (
        para_todos = true
        AND EXISTS (
          SELECT 1 FROM alumnos_extra ae
          WHERE ae.alumno_id = auth.uid()
            AND ae.profesor_id = subido_por
        )
      )
    )
  );

-- -------------------------------------------------------
-- recursos_acceso — drop and recreate all policies
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin: full access recursos_acceso"      ON recursos_acceso;
DROP POLICY IF EXISTS "profesor: manage acceso own recursos"    ON recursos_acceso;
DROP POLICY IF EXISTS "alumno: select own accesos"             ON recursos_acceso;

-- ADMIN: full access
CREATE POLICY "admin: full access recursos_acceso"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING      (get_user_rol() = 'admin')
  WITH CHECK (get_user_rol() = 'admin');

-- PROFESOR: manage acceso records for their own resources
CREATE POLICY "profesor: manage acceso own recursos"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND EXISTS (
      SELECT 1 FROM recursos_compartidos rc
      WHERE rc.id = recursos_acceso.recurso_id
        AND rc.subido_por = auth.uid()
    )
  )
  WITH CHECK (
    get_user_rol() = 'profesor'
    AND EXISTS (
      SELECT 1 FROM recursos_compartidos rc
      WHERE rc.id = recursos_acceso.recurso_id
        AND rc.subido_por = auth.uid()
    )
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
