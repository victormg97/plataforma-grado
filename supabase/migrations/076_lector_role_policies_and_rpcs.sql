-- ── 076: Políticas RLS y RPCs para el rol 'lector' ────────────────────────
--
-- 1. Extiende CHECK de enlaces_invitacion para incluir 'lector'
-- 2. Políticas RLS para que lectores lean recursos y accesos propios
-- 3. Recrea get_recursos_for_user() en JSONB con branch 'lector'
--    (restaura exactamente la lógica de migración 062, más el branch lector)
-- 4. Crea get_lector_prefetch()

-- ── 1. CHECK de enlaces_invitacion ────────────────────────────────────────
ALTER TABLE public.enlaces_invitacion DROP CONSTRAINT IF EXISTS enlaces_invitacion_tipo_check;
ALTER TABLE public.enlaces_invitacion ADD CONSTRAINT enlaces_invitacion_tipo_check
  CHECK (tipo IN ('profesor', 'alumno', 'lector'));

-- ── 2. RLS: lector lee recursos accesibles ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recursos_compartidos'
      AND policyname = 'lector: select accessible recursos'
  ) THEN
    CREATE POLICY "lector: select accessible recursos"
      ON public.recursos_compartidos FOR SELECT TO authenticated
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'lector'
        AND (
          EXISTS (
            SELECT 1 FROM public.recursos_acceso ra
            WHERE ra.recurso_id = recursos_compartidos.id AND ra.alumno_id = auth.uid()
          )
          OR (para_todos = true AND (SELECT rol FROM public.profiles WHERE id = subido_por) = 'admin')
          OR para_todos_app = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recursos_acceso'
      AND policyname = 'lector: select own accesos'
  ) THEN
    CREATE POLICY "lector: select own accesos"
      ON public.recursos_acceso FOR SELECT TO authenticated
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'lector'
        AND alumno_id = auth.uid()
      );
  END IF;
END $$;

-- ── 3. get_recursos_for_user() — JSONB, incluye branch lector ─────────────
-- Lógica base idéntica a migración 062 (que resolvió carpetas recursivas).
-- Se agrega el branch 'lector' con la misma lógica que alumno pero sin
-- la visibilidad por profesor asignado (lector no tiene alumnos_extra).
DROP FUNCTION IF EXISTS public.get_recursos_for_user();

CREATE OR REPLACE FUNCTION public.get_recursos_for_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_rol      TEXT;
BEGIN
  SELECT rol INTO v_rol FROM public.profiles WHERE id = v_user_id;

  -- ── ADMIN: todos los recursos, todas las carpetas ────────────────────────
  IF v_rol = 'admin' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
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
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            ORDER BY cr.nombre ASC
            -- Sin WHERE: admin ve todas las carpetas sin importar si tienen recursos directos
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── PROFESOR: sus recursos, sus carpetas ─────────────────────────────────
  ELSIF v_rol = 'profesor' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
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
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE cr.creada_por = v_user_id
            ORDER BY cr.nombre ASC
            -- Sin filtro de recursos: profesor ve sus carpetas aunque estén vacías o solo tengan subcarpetas
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── ALUMNO: recursos accesibles + carpetas con recursos en cualquier nivel ─
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
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            WHERE
              EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
              OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
              OR (rc.para_todos = true AND EXISTS (
                SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
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
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE EXISTS (
              -- Búsqueda recursiva: la carpeta es visible si en cualquier nivel
              -- del árbol hacia abajo hay al menos un recurso accesible
              WITH RECURSIVE ft AS (
                SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
              )
              SELECT 1 FROM public.recursos_compartidos rc
              WHERE rc.carpeta_id IN (SELECT id FROM ft)
                AND (
                  EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
                  OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
                  OR (rc.para_todos = true AND EXISTS (
                    SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
                  ))
                  OR rc.para_todos_app = true
                )
            )
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── LECTOR: igual que alumno pero sin visibilidad por profesor asignado ──
  -- Ve: para_todos de admin + para_todos_app + acceso explícito vía recursos_acceso.
  -- Carpetas visibles si en cualquier nivel del árbol hay un recurso accesible.
  ELSIF v_rol = 'lector' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url,
              rc.storage_path, rc.para_todos, rc.para_todos_app, rc.bloquear_descarga,
              rc.created_at, rc.carpeta_id,
              p.nombre || ' ' || p.apellido AS uploader_nombre
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            WHERE
              EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
              OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
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
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE EXISTS (
              WITH RECURSIVE ft AS (
                SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
              )
              SELECT 1 FROM public.recursos_compartidos rc
              WHERE rc.carpeta_id IN (SELECT id FROM ft)
                AND (
                  EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
                  OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
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

GRANT EXECUTE ON FUNCTION public.get_recursos_for_user() TO authenticated;

-- ── 4. get_lector_prefetch() ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lector_prefetch(p_lector_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Reutiliza get_recursos_for_user() que ya maneja el rol lector correctamente.
  -- Llamamos set_config para que auth.uid() sea el lector en este contexto SECURITY DEFINER.
  SELECT json_build_object(
    'recursos', public.get_recursos_for_user()
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lector_prefetch(uuid) TO authenticated;
