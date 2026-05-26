-- Fix: the programas_clases SELECT policy (015) referenced asignaciones_programa,
-- which has a policy that references programas_clases → infinite recursion.
-- Solution: wrap the assignment check in a SECURITY DEFINER function so it runs
-- without RLS and breaks the cycle.

CREATE OR REPLACE FUNCTION alumno_tiene_asignacion_activa(p_programa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM asignaciones_programa
    WHERE programa_id = p_programa_id
      AND alumno_id = auth.uid()
      AND estado = 'activo'
  );
$$;

-- Rebuild the programas_clases SELECT policy using the function instead of a direct subquery
DROP POLICY IF EXISTS "Usuarios ven programas según visibilidad" ON public.programas_clases;

CREATE POLICY "Usuarios ven programas según visibilidad" ON public.programas_clases
  FOR SELECT USING (
    get_user_rol() = 'admin'
    OR visibilidad = 'todos'
    OR (
      visibilidad = 'especifico'
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM programa_profesores pp
          WHERE pp.programa_id = programas_clases.id
            AND pp.profesor_id = auth.uid()
        )
      )
    )
    OR alumno_tiene_asignacion_activa(programas_clases.id)
  );
