-- Allow alumnos to update their own editable profile fields in alumnos_extra.
-- Only allows updating universidad, año_ingreso and intentos_prueba.
-- paso_prueba, fecha_prueba, notas, and profesor_id remain restricted to profesores/admin.
CREATE POLICY "Alumno edita sus propios campos de perfil"
  ON public.alumnos_extra
  FOR UPDATE
  USING (alumno_id = auth.uid())
  WITH CHECK (alumno_id = auth.uid());
