-- Allow alumnos to insert their own alumnos_extra row.
-- This is needed when the alumno edits their profile before a profesor has created their ficha.
CREATE POLICY "Alumno inserta su propia ficha"
  ON public.alumnos_extra
  FOR INSERT
  WITH CHECK (alumno_id = auth.uid());
