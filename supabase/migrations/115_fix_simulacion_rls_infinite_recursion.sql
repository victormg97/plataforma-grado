-- Fix infinite recursion in simulacion_comision and simulacion_evaluaciones RLS
-- Root cause: self-referencing queries and cross-table RLS cycles

-- Helper function to check horario ownership without triggering RLS cycles
CREATE OR REPLACE FUNCTION public.is_horario_participant(p_horario_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM horarios h
    WHERE h.id = p_horario_id
      AND (h.profesor_id = auth.uid() OR h.alumno_id = auth.uid())
  );
$$;

-- ============================================================
-- Fix simulacion_comision SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "simulacion_comision_select" ON simulacion_comision;
CREATE POLICY "simulacion_comision_select"
  ON simulacion_comision FOR SELECT
  TO authenticated
  USING (
    -- Direct member: current user IS this commission row's profesor
    profesor_id = (SELECT auth.uid())
    -- Participant of the horario (profesor or alumno)
    OR public.is_horario_participant(horario_id)
    -- Admin
    OR (SELECT public.get_user_rol()) = 'admin'
  );

-- Fix simulacion_comision INSERT policy
DROP POLICY IF EXISTS "simulacion_comision_insert" ON simulacion_comision;
CREATE POLICY "simulacion_comision_insert"
  ON simulacion_comision FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_horario_participant(horario_id)
    OR (SELECT public.get_user_rol()) = 'admin'
  );

-- Fix simulacion_comision DELETE policy
DROP POLICY IF EXISTS "simulacion_comision_delete" ON simulacion_comision;
CREATE POLICY "simulacion_comision_delete"
  ON simulacion_comision FOR DELETE
  TO authenticated
  USING (
    public.is_horario_participant(horario_id)
    OR (SELECT public.get_user_rol()) = 'admin'
  );

-- ============================================================
-- Fix simulacion_evaluaciones SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "simulacion_evaluaciones_select" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_select"
  ON simulacion_evaluaciones FOR SELECT
  TO authenticated
  USING (
    -- The professor who owns this evaluation
    profesor_id = (SELECT auth.uid())
    -- Participant of the horario (profesor or alumno)
    OR public.is_horario_participant(horario_id)
    -- Admin
    OR (SELECT public.get_user_rol()) = 'admin'
  );

-- Fix simulacion_evaluaciones INSERT policy
DROP POLICY IF EXISTS "simulacion_evaluaciones_insert" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_insert"
  ON simulacion_evaluaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_horario_participant(horario_id)
    OR (SELECT public.get_user_rol()) = 'admin'
  );

-- Fix simulacion_evaluaciones UPDATE policy (keep simple, just add admin fallback)
DROP POLICY IF EXISTS "simulacion_evaluaciones_update" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_update"
  ON simulacion_evaluaciones FOR UPDATE
  TO authenticated
  USING (
    profesor_id = (SELECT auth.uid())
    OR (SELECT public.get_user_rol()) = 'admin'
  )
  WITH CHECK (
    profesor_id = (SELECT auth.uid())
    OR (SELECT public.get_user_rol()) = 'admin'
  );
