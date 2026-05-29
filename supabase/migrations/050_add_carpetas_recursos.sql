-- ============================================================
-- 050_add_carpetas_recursos.sql
-- Folder system for recursos_compartidos
-- ============================================================

-- 1. Carpetas table
CREATE TABLE public.carpetas_recursos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  parent_id   uuid        REFERENCES public.carpetas_recursos(id) ON DELETE CASCADE,
  creada_por  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX carpetas_recursos_parent_id_idx ON public.carpetas_recursos(parent_id);
CREATE INDEX carpetas_recursos_creada_por_idx ON public.carpetas_recursos(creada_por);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.carpetas_recursos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER carpetas_recursos_updated_at
  BEFORE UPDATE ON public.carpetas_recursos
  FOR EACH ROW EXECUTE FUNCTION public.carpetas_recursos_set_updated_at();

-- RLS
ALTER TABLE public.carpetas_recursos ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "carpetas_admin_all" ON public.carpetas_recursos
  FOR ALL TO authenticated
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Profesor: CRUD own folders
CREATE POLICY "carpetas_profesor_select" ON public.carpetas_recursos
  FOR SELECT TO authenticated
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor'
    AND creada_por = auth.uid()
  );

CREATE POLICY "carpetas_profesor_insert" ON public.carpetas_recursos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor'
    AND creada_por = auth.uid()
  );

CREATE POLICY "carpetas_profesor_update" ON public.carpetas_recursos
  FOR UPDATE TO authenticated
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor'
    AND creada_por = auth.uid()
  );

CREATE POLICY "carpetas_profesor_delete" ON public.carpetas_recursos
  FOR DELETE TO authenticated
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor'
    AND creada_por = auth.uid()
  );

-- 2. Add carpeta_id to recursos_compartidos
ALTER TABLE public.recursos_compartidos
  ADD COLUMN carpeta_id uuid REFERENCES public.carpetas_recursos(id) ON DELETE SET NULL;

CREATE INDEX recursos_compartidos_carpeta_id_idx ON public.recursos_compartidos(carpeta_id);

-- Alumno: read folders that contain resources they can access
CREATE POLICY "carpetas_alumno_select" ON public.carpetas_recursos
  FOR SELECT TO authenticated
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'alumno'
    AND EXISTS (
      SELECT 1 FROM public.recursos_compartidos rc
      WHERE rc.carpeta_id = carpetas_recursos.id
        AND (
          EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = auth.uid())
          OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
          OR (rc.para_todos = true AND EXISTS (
            SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = auth.uid() AND ae.profesor_id = rc.subido_por
          ))
        )
    )
  );

-- 3. Update RPC to include carpeta_id and return folders
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
            SELECT cr.*, p.nombre || ' ' || p.apellido AS creador_nombre
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
            SELECT cr.*, p.nombre || ' ' || p.apellido AS creador_nombre
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
              p.nombre || ' ' || p.apellido AS creador_nombre
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
