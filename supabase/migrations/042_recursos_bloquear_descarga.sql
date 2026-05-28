-- =============================================================
-- 042_recursos_bloquear_descarga.sql
-- Adds bloquear_descarga flag to recursos_compartidos.
-- When true, alumnos can preview the file but cannot download it.
-- =============================================================

-- 1. Add column (default false → no breaking change for existing rows)
ALTER TABLE recursos_compartidos
  ADD COLUMN IF NOT EXISTS bloquear_descarga BOOLEAN NOT NULL DEFAULT false;

-- 2. Update RPC get_recursos_for_user to include the new column
CREATE OR REPLACE FUNCTION get_recursos_for_user()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_rol      TEXT;
BEGIN
  SELECT rol INTO v_rol FROM profiles WHERE id = v_user_id;

  IF v_rol = 'admin' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.*,
          p.nombre || ' ' || p.apellido AS uploader_nombre,
          (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'profesor' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.*,
          p.nombre || ' ' || p.apellido AS uploader_nombre,
          (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        WHERE rc.subido_por = v_user_id
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'alumno' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.id,
          rc.titulo,
          rc.descripcion,
          rc.tipo,
          rc.url,
          rc.storage_path,
          rc.para_todos,
          rc.bloquear_descarga,
          rc.created_at,
          p.nombre || ' ' || p.apellido AS uploader_nombre
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        WHERE
          EXISTS (
            SELECT 1 FROM recursos_acceso ra
            WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id
          )
          OR (rc.para_todos = true AND (SELECT rol FROM profiles WHERE id = rc.subido_por) = 'admin')
          OR (
            rc.para_todos = true
            AND EXISTS (
              SELECT 1 FROM alumnos_extra ae
              WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
            )
          )
        ORDER BY rc.created_at DESC
      ) r
    );
  END IF;

  RETURN '[]'::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recursos_for_user() TO authenticated;
