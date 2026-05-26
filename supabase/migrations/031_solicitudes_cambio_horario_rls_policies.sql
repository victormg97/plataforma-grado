-- =============================================================
-- 031_solicitudes_cambio_horario_rls_policies.sql
-- RLS policies for solicitudes_cambio_horario table:
--   - Alumno: SELECT own rows, INSERT own rows
--   - Profesor: SELECT own rows, UPDATE own rows
--   - Admin: SELECT all rows
-- =============================================================

-- ALUMNO: select own solicitudes
CREATE POLICY "alumno: select own solicitudes_cambio"
  ON public.solicitudes_cambio_horario
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'alumno'
    AND alumno_id = auth.uid()
  );

-- ALUMNO: insert own solicitudes
CREATE POLICY "alumno: insert own solicitud_cambio"
  ON public.solicitudes_cambio_horario
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_rol() = 'alumno'
    AND alumno_id = auth.uid()
  );

-- PROFESOR: select solicitudes directed to them
CREATE POLICY "profesor: select own solicitudes_cambio"
  ON public.solicitudes_cambio_horario
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND profesor_id = auth.uid()
  );

-- PROFESOR: update solicitudes directed to them
CREATE POLICY "profesor: update own solicitudes_cambio"
  ON public.solicitudes_cambio_horario
  FOR UPDATE
  TO authenticated
  USING (
    get_user_rol() = 'profesor'
    AND profesor_id = auth.uid()
  )
  WITH CHECK (
    profesor_id = auth.uid()
  );

-- ADMIN: select all solicitudes
CREATE POLICY "admin: select all solicitudes_cambio"
  ON public.solicitudes_cambio_horario
  FOR SELECT
  TO authenticated
  USING (
    get_user_rol() = 'admin'
  );
