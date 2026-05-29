-- ============================================================
-- 052_update_carpetas_permisos_efectivos.sql
-- Update RPC to include effective permissions per folder
-- (derived from the resources inside each folder)
-- ============================================================

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
      SELECT json_build_object(
        'recursos', COALESCE((
          SELECT json_agg(row_to_json(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM recursos_compartidos rc
            JOIN profiles p ON p.id = rc.subido_por
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::json),
        'carpetas', COALESCE((
          SELECT json_agg(row_to_json(c))
          FROM (
            SELECT
              cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              EXISTS (
                SELECT 1 FROM recursos_compartidos rc2
                WHERE rc2.carpeta_id = cr.id AND rc2.para_todos = true
              ) AS para_todos_efectivo,
              COALESCE((
                SELECT json_agg(DISTINCT ra2.alumno_id)
                FROM recursos_acceso ra2
                JOIN recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id = cr.id
              ), '[]'::json) AS alumno_ids_efectivos
            FROM carpetas_recursos cr
            JOIN profiles p ON p.id = cr.creada_por
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::json)
      )
    );

  ELSIF v_rol = 'profesor' THEN
    RETURN (
      SELECT json_build_object(
        'recursos', COALESCE((
          SELECT json_agg(row_to_json(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM recursos_compartidos rc
            JOIN profiles p ON p.id = rc.subido_por
            WHERE rc.subido_por = v_user_id
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::json),
        'carpetas', COALESCE((
          SELECT json_agg(row_to_json(c))
          FROM (
            SELECT
              cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              EXISTS (
                SELECT 1 FROM recursos_compartidos rc2
                WHERE rc2.carpeta_id = cr.id AND rc2.para_todos = true AND rc2.subido_por = v_user_id
              ) AS para_todos_efectivo,
              COALESCE((
                SELECT json_agg(DISTINCT ra2.alumno_id)
                FROM recursos_acceso ra2
                JOIN recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id = cr.id AND rc3.subido_por = v_user_id
              ), '[]'::json) AS alumno_ids_efectivos
            FROM carpetas_recursos cr
            JOIN profiles p ON p.id = cr.creada_por
            WHERE cr.creada_por = v_user_id
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::json)
      )
    );

  ELSIF v_rol = 'alumno' THEN
    RETURN (
      SELECT json_build_object(
        'recursos', COALESCE((
          SELECT json_agg(row_to_json(r))
          FROM (
            SELECT rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url,
              rc.storage_path, rc.para_todos, rc.bloquear_descarga,
              rc.created_at, rc.carpeta_id,
              p.nombre || ' ' || p.apellido AS uploader_nombre
            FROM recursos_compartidos rc
            JOIN profiles p ON p.id = rc.subido_por
            WHERE
              EXISTS (SELECT 1 FROM recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
              OR (rc.para_todos = true AND (SELECT rol FROM profiles WHERE id = rc.subido_por) = 'admin')
              OR (rc.para_todos = true AND EXISTS (
                SELECT 1 FROM alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
              ))
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::json),
        'carpetas', COALESCE((
          SELECT json_agg(row_to_json(c))
          FROM (
            SELECT DISTINCT cr.id, cr.nombre, cr.parent_id, cr.creada_por, cr.created_at, cr.updated_at,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              false AS para_todos_efectivo,
              '[]'::json AS alumno_ids_efectivos
            FROM carpetas_recursos cr
            JOIN profiles p ON p.id = cr.creada_por
            WHERE EXISTS (
              SELECT 1 FROM recursos_compartidos rc
              WHERE rc.carpeta_id = cr.id
                AND (
                  EXISTS (SELECT 1 FROM recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
                  OR (rc.para_todos = true AND (SELECT rol FROM profiles WHERE id = rc.subido_por) = 'admin')
                  OR (rc.para_todos = true AND EXISTS (
                    SELECT 1 FROM alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
                  ))
                )
            )
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::json)
      )
    );
  END IF;

  RETURN json_build_object('recursos', '[]'::json, 'carpetas', '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_recursos_for_user() TO authenticated;
