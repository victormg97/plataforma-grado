-- ── 076: Políticas RLS, CHECK constraint y RPCs para el rol 'lector' ──────

-- ── 1. Extender CHECK de enlaces_invitacion para incluir 'lector' ──────────
ALTER TABLE public.enlaces_invitacion DROP CONSTRAINT IF EXISTS enlaces_invitacion_tipo_check;
ALTER TABLE public.enlaces_invitacion ADD CONSTRAINT enlaces_invitacion_tipo_check
  CHECK (tipo IN ('profesor', 'alumno', 'lector'));

-- ── 2. Política RLS: lectores pueden leer recursos accesibles ──────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'recursos_compartidos'
      AND policyname = 'lector: select accessible recursos'
  ) THEN
    CREATE POLICY "lector: select accessible recursos"
      ON public.recursos_compartidos
      FOR SELECT
      TO authenticated
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'lector'
        AND (
          EXISTS (
            SELECT 1 FROM public.recursos_acceso ra
            WHERE ra.recurso_id = recursos_compartidos.id
              AND ra.alumno_id = auth.uid()
          )
          OR (
            para_todos = true
            AND (SELECT rol FROM public.profiles WHERE id = subido_por) = 'admin'
          )
          OR para_todos_app = true
        )
      );
  END IF;
END $$;

-- Lectores pueden ver sus propias entradas en recursos_acceso
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'recursos_acceso'
      AND policyname = 'lector: select own accesos'
  ) THEN
    CREATE POLICY "lector: select own accesos"
      ON public.recursos_acceso
      FOR SELECT
      TO authenticated
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'lector'
        AND alumno_id = auth.uid()
      );
  END IF;
END $$;

-- ── 3. Reemplazar get_recursos_for_user con soporte para 'lector' ──────────
DROP FUNCTION IF EXISTS public.get_recursos_for_user();

CREATE OR REPLACE FUNCTION public.get_recursos_for_user()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_rol      TEXT;
BEGIN
  SELECT rol INTO v_rol FROM public.profiles WHERE id = v_user_id;

  IF v_rol = 'admin' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.*,
          p.nombre || ' ' || p.apellido AS uploader_nombre,
          (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM public.recursos_compartidos rc
        JOIN public.profiles p ON p.id = rc.subido_por
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
          (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM public.recursos_compartidos rc
        JOIN public.profiles p ON p.id = rc.subido_por
        WHERE rc.subido_por = v_user_id
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'alumno' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url, rc.storage_path,
          rc.para_todos, rc.para_todos_app, rc.bloquear_descarga, rc.carpeta_id, rc.created_at,
          p.nombre || ' ' || p.apellido AS uploader_nombre
        FROM public.recursos_compartidos rc
        JOIN public.profiles p ON p.id = rc.subido_por
        WHERE
          EXISTS (
            SELECT 1 FROM public.recursos_acceso ra
            WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id
          )
          OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
          OR (
            rc.para_todos = true
            AND EXISTS (
              SELECT 1 FROM public.alumnos_extra ae
              WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
            )
          )
          OR rc.para_todos_app = true
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'lector' THEN
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url, rc.storage_path,
          rc.para_todos, rc.para_todos_app, rc.bloquear_descarga, rc.carpeta_id, rc.created_at,
          p.nombre || ' ' || p.apellido AS uploader_nombre
        FROM public.recursos_compartidos rc
        JOIN public.profiles p ON p.id = rc.subido_por
        WHERE
          EXISTS (
            SELECT 1 FROM public.recursos_acceso ra
            WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id
          )
          OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
          OR rc.para_todos_app = true
        ORDER BY rc.created_at DESC
      ) r
    );
  END IF;

  RETURN '[]'::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recursos_for_user() TO authenticated;

-- ── 4. RPC get_lector_prefetch ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lector_prefetch(p_lector_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'recursos', json_build_object(
      'recursos', COALESCE((
        SELECT json_agg(row_to_json(r))
        FROM (
          SELECT
            rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url, rc.storage_path,
            rc.para_todos, rc.para_todos_app, rc.bloquear_descarga, rc.carpeta_id, rc.created_at,
            p.nombre || ' ' || p.apellido AS uploader_nombre
          FROM public.recursos_compartidos rc
          JOIN public.profiles p ON p.id = rc.subido_por
          WHERE
            EXISTS (
              SELECT 1 FROM public.recursos_acceso ra
              WHERE ra.recurso_id = rc.id AND ra.alumno_id = p_lector_id
            )
            OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
            OR rc.para_todos_app = true
          ORDER BY rc.created_at DESC
        ) r
      ), '[]'::json),
      'carpetas', COALESCE((
        SELECT json_agg(row_to_json(c))
        FROM (
          SELECT cr.*
          FROM public.carpetas_recursos cr
          WHERE EXISTS (
            SELECT 1 FROM public.recursos_compartidos rc2
            WHERE rc2.carpeta_id = cr.id
              AND (
                EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc2.id AND ra.alumno_id = p_lector_id)
                OR (rc2.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc2.subido_por) = 'admin')
                OR rc2.para_todos_app = true
              )
          )
        ) c
      ), '[]'::json)
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lector_prefetch(uuid) TO authenticated;
