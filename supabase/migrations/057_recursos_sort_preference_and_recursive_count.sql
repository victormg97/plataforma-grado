-- ============================================================
-- 056_recursos_sort_preference_and_recursive_count.sql
-- 1. Add user sort preference for recursos view
-- 2. Update RPC to include recursive resource count per folder
-- ============================================================

-- 1. Add sort preference column to user_preferences (or create a separate table)
--    We store it in a simple jsonb column on profiles or a dedicated table.
--    Using a dedicated table to avoid touching profiles schema.

CREATE TABLE IF NOT EXISTS public.user_recursos_preferences (
  user_id       uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_by       text        NOT NULL DEFAULT 'created_at_desc'
                            CHECK (sort_by IN ('created_at_desc', 'created_at_asc', 'nombre_asc', 'nombre_desc', 'tipo_asc')),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_recursos_preferences ENABLE ROW LEVEL SECURITY;

-- Each user can only read/write their own preference
CREATE POLICY "user_recursos_prefs_select" ON public.user_recursos_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_recursos_prefs_insert" ON public.user_recursos_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_recursos_prefs_update" ON public.user_recursos_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Helper function: recursively count resources inside a folder (all depths)
CREATE OR REPLACE FUNCTION public.count_recursos_in_folder(p_folder_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE folder_tree AS (
    -- Base: the folder itself
    SELECT id FROM public.carpetas_recursos WHERE id = p_folder_id
    UNION ALL
    -- Recurse: all child folders
    SELECT cr.id
    FROM public.carpetas_recursos cr
    INNER JOIN folder_tree ft ON cr.parent_id = ft.id
  )
  SELECT COUNT(*)
  FROM public.recursos_compartidos rc
  WHERE rc.carpeta_id IN (SELECT id FROM folder_tree);
$$;

GRANT EXECUTE ON FUNCTION public.count_recursos_in_folder(uuid) TO authenticated;

-- 3. Update get_recursos_for_user to include recursive_recursos_count per folder
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
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
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
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
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
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
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
