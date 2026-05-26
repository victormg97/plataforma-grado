-- SECURITY DEFINER function so a professor/admin can delete programa_asignado
-- notifications that belong to alumnos (bypasses the "destinatario_id = auth.uid()" RLS).
-- The function itself verifies the caller is authorized before deleting.

CREATE OR REPLACE FUNCTION delete_programa_asignado_notifications(
  p_programa_id uuid,
  p_alumno_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be admin OR the creator/assigned-professor of the program.
  IF NOT (
    get_user_rol() = 'admin'
    OR EXISTS (
      SELECT 1 FROM programas_clases
      WHERE id = p_programa_id
        AND created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM programa_profesores
      WHERE programa_id = p_programa_id
        AND profesor_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado para eliminar notificaciones de este programa';
  END IF;

  DELETE FROM notificaciones
  WHERE tipo = 'programa_asignado'
    AND programa_id = p_programa_id
    AND destinatario_id = ANY(p_alumno_ids);
END;
$$;
