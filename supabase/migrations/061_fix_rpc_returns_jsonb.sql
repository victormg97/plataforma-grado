-- ============================================================
-- 060_fix_rpc_returns_jsonb.sql
-- Change get_recursos_for_user to return JSONB instead of JSON.
-- PostgREST requires an equality operator on the return type for
-- certain internal operations; json lacks one but jsonb has it.
-- The error "could not identify an equality operator for type json"
-- (code 42883) was causing the RPC to fail for all roles.
-- ============================================================

DROP FUNCTION IF EXISTS get_recursos_for_user();

CREATE OR REPLACE FUNCTION get_recursos_for_user()
RETURNS JSONB
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
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM recursos_compartidos rc
            JOIN profiles p ON p.id = rc.subido_por
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT
              cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos = true
              ) AS para_todos_efectivo,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos_app = true
              ) AS para_todos_app_efectivo,
              COALESCE((
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT jsonb_agg(DISTINCT ra2.alumno_id)
                FROM public.recursos_acceso ra2
                JOIN public.recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id IN (SELECT id FROM ft)
              ), '[]'::jsonb) AS alumno_ids_efectivos
            FROM carpetas_recursos cr
            JOIN profiles p ON p.id = cr.creada_por
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  ELSIF v_rol = 'profesor' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM recursos_compartidos rc
            JOIN profiles p ON p.id = rc.subido_por
            WHERE rc.subido_por = v_user_id
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT
              cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft)
                  AND rc2.para_todos = true AND rc2.subido_por = v_user_id
              ) AS para_todos_efectivo,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft)
                  AND rc2.para_todos_app = true AND rc2.subido_por = v_user_id
              ) AS para_todos_app_efectivo,
              COALESCE((
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT jsonb_agg(DISTINCT ra2.alumno_id)
                FROM public.recursos_acceso ra2
                JOIN public.recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id IN (SELECT id FROM ft) AND rc3.subido_por = v_user_id
              ), '[]'::jsonb) AS alumno_ids_efectivos
            FROM carpetas_recursos cr
            JOIN profiles p ON p.id = cr.creada_por
            WHERE cr.creada_por = v_user_id
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  ELSIF v_rol = 'alumno' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url,
              rc.storage_path, rc.para_todos, rc.para_todos_app, rc.bloquear_descarga,
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
              OR rc.para_todos_app = true
            ORDER BY rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT DISTINCT cr.id, cr.nombre, cr.parent_id, cr.creada_por, cr.created_at, cr.updated_at,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              false AS para_todos_efectivo,
              false AS para_todos_app_efectivo,
              '[]'::jsonb AS alumno_ids_efectivos
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
                  OR rc.para_todos_app = true
                )
            )
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );
  END IF;

  RETURN jsonb_build_object('recursos', '[]'::jsonb, 'carpetas', '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_recursos_for_user() TO authenticated;
