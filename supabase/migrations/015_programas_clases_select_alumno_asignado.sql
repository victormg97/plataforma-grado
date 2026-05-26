-- Allow alumnos to see programs they are actively assigned to,
-- regardless of visibilidad. This avoids needing a service role key.
DROP POLICY IF EXISTS "Usuarios ven programas según visibilidad" ON public.programas_clases;

CREATE POLICY "Usuarios ven programas según visibilidad" ON public.programas_clases
  FOR SELECT USING (
    -- Admins see everything
    get_user_rol() = 'admin'
    OR
    -- Global programs visible to all authenticated users
    visibilidad = 'todos'
    OR
    -- Specific programs: creator or assigned professors can see
    (
      visibilidad = 'especifico'
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.programa_profesores pp
          WHERE pp.programa_id = programas_clases.id
            AND pp.profesor_id = auth.uid()
        )
      )
    )
    OR
    -- Alumnos can always see programs they are actively assigned to
    EXISTS (
      SELECT 1 FROM public.asignaciones_programa a
      WHERE a.programa_id = programas_clases.id
        AND a.alumno_id = auth.uid()
        AND a.estado = 'activo'
    )
  );
