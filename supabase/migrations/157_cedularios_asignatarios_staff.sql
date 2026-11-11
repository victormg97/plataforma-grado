-- =============================================================================
-- 157_cedularios_asignatarios_staff.sql
--
-- Purpose: profesores and administradores can also be ASSIGNEES of a cedulario
-- (personal study tracking), not only alumnos.
--   - admin     can assign to anybody (alumno, profesor, admin, itself included)
--   - profesor  can assign to own alumnos and to itself
--
-- Design: the column cedulario_asignaciones.alumno_id keeps its name and now
-- means "assignee" (alumno, profesor or admin). Every write path of 154 funnels
-- through two helpers, which are redefined here with the same names and
-- signatures:
--   puede_gestionar_seguimiento_alumno(uuid)   permission (42501)
--   seguimiento_alumno_valido(uuid)            validity  (CD011, code unchanged)
-- Nothing else on the write side changes.
--
-- Visibility: staff SELECT used to be role-only ('admin','profesor'). A
-- profesor must never read another staff member's personal progress, so two new
-- helpers gate it:
--   seg_puede_ver_asignatario(uuid)   admin: all; profesor: alumnos + itself;
--                                     alumno: itself; anybody else: nothing
--   seg_puede_ver_asignacion(uuid)    the same, for the assignee of an assignment
-- and the SELECT policies of 154 / 152 and the SECURITY DEFINER readers
-- (get_progreso_detalle, get_asignacion_materias_inactivas,
-- get_asignacion_actividad) use them. The alumno branches are unchanged.
-- Staff SELECT policies still depend only on immutable data (the assignee), so
-- UPDATE ... RETURNING keeps working.
--
-- RPC changes (DROP + CREATE because the returned table changes):
--   get_alumno_cedularios_resumen   + alumno_rol
--   get_cedulario_alumnos_resumen   + alumno_rol
--   listar_alumnos_asignables       + rol (active staff the caller manages too)
-- New: get_cedularios_staff_resumen() (admin only): active assignments count
-- per profesor / admin, for the Profesores list.
--
-- Idempotent: CREATE OR REPLACE / DROP ... IF EXISTS. Error codes unchanged.
-- Every function: REVOKE from PUBLIC and anon, GRANT to authenticated.
-- =============================================================================

-- =============================================================================
-- SECTION 1: PERMISSION AND VALIDITY HELPERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- puede_gestionar_seguimiento_alumno: the "manager of the assignee".
--   admin     any alumno, profesor or admin profile
--   profesor  an own alumno, or itself (when its profile rol is 'profesor')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.puede_gestionar_seguimiento_alumno(p_alumno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE public.get_user_rol()
      WHEN 'admin' THEN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_alumno_id AND p.rol IN ('alumno', 'profesor', 'admin')
      )
      WHEN 'profesor' THEN (
        (
          public.es_alumno_propio(p_alumno_id)
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_alumno_id AND p.rol = 'alumno')
        )
        OR (
          p_alumno_id = auth.uid()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_alumno_id AND p.rol = 'profesor')
        )
      )
      ELSE false
    END,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.puede_gestionar_seguimiento_alumno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_gestionar_seguimiento_alumno(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seguimiento_alumno_valido: the profile is an alumno, profesor or admin and
-- is active (CD011 otherwise, raised by the guards).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seguimiento_alumno_valido(p_alumno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_alumno_id
        AND p.rol IN ('alumno', 'profesor', 'admin')
        AND p.activo = true
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seguimiento_alumno_valido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguimiento_alumno_valido(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_puede_ver_asignatario: the current user may READ the tracking data of
-- the assignee.
--   admin     everybody
--   profesor  every alumno, and itself
--   alumno    itself
--   others    nobody (lector, anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_puede_ver_asignatario(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE public.get_user_rol()
      WHEN 'admin' THEN true
      WHEN 'profesor' THEN (
        p_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_id AND p.rol = 'alumno')
      )
      WHEN 'alumno' THEN p_id = auth.uid()
      ELSE false
    END,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seg_puede_ver_asignatario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_puede_ver_asignatario(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_puede_ver_asignacion: seg_puede_ver_asignatario applied to the assignee
-- of an assignment. False when the assignment does not exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_puede_ver_asignacion(p_asignacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.seg_puede_ver_asignatario(public.seg_asignacion_alumno(p_asignacion_id)),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seg_puede_ver_asignacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_puede_ver_asignacion(uuid) TO authenticated;

-- =============================================================================
-- SECTION 2: SELECT POLICIES (same names as 154 / 152)
-- Staff branch: admin, or profesor limited by the helper. Alumno branch as is.
-- =============================================================================
DROP POLICY IF EXISTS "Staff ve asignaciones, alumno ve las suyas activas" ON public.cedulario_asignaciones;
CREATE POLICY "Staff ve asignaciones, alumno ve las suyas activas" ON public.cedulario_asignaciones
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND public.seg_puede_ver_asignatario(alumno_id)
    )
    OR (
      alumno_id = (select auth.uid())
      AND estado = 'activa'
    )
  );

DROP POLICY IF EXISTS "Staff ve progreso, alumno ve el asignado de sus asignaciones" ON public.materia_progreso;
CREATE POLICY "Staff ve progreso, alumno ve el asignado de sus asignaciones" ON public.materia_progreso
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND public.seg_puede_ver_asignacion(asignacion_id)
    )
    OR (
      asignada
      AND public.seg_alumno_ve_progreso(id)
    )
  );

DROP POLICY IF EXISTS "Staff ve repasos, alumno ve los de su progreso" ON public.materia_progreso_repasos;
CREATE POLICY "Staff ve repasos, alumno ve los de su progreso" ON public.materia_progreso_repasos
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND public.seg_puede_ver_asignacion(asignacion_id)
    )
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

DROP POLICY IF EXISTS "Staff ve comentarios, alumno ve los de su progreso" ON public.materia_progreso_comentarios;
CREATE POLICY "Staff ve comentarios, alumno ve los de su progreso" ON public.materia_progreso_comentarios
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND public.seg_puede_ver_asignacion(asignacion_id)
    )
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

DROP POLICY IF EXISTS "Staff ve clases vinculadas, alumno ve las de su progreso" ON public.materia_progreso_clases;
CREATE POLICY "Staff ve clases vinculadas, alumno ve las de su progreso" ON public.materia_progreso_clases
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND public.seg_puede_ver_asignacion(asignacion_id)
    )
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

-- historial_cambios: admin sees every row. A profesor keeps the 152 rule
-- (universidad rows and rows of ACTIVE cedularios) and, for activity rows that
-- carry metadata.asignacion_id, also needs to be allowed to see that assignee.
-- The CASE keeps the uuid cast away from rows without asignacion_id.
DROP POLICY IF EXISTS "Admin y profesor ven historial de cedularios visibles" ON public.historial_cambios;
CREATE POLICY "Admin y profesor ven historial de cedularios visibles" ON public.historial_cambios
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND (
        cedulario_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.cedularios c
          WHERE c.id = historial_cambios.cedulario_id
            AND c.activo
        )
      )
      AND CASE
        WHEN metadata ->> 'asignacion_id' IS NULL THEN true
        ELSE public.seg_puede_ver_asignacion((metadata ->> 'asignacion_id')::uuid)
      END
    )
  );

-- =============================================================================
-- SECTION 3: SECURITY DEFINER READERS (bodies of 154, plus the visibility check)
-- =============================================================================

-- get_progreso_detalle: a profesor also needs seg_puede_ver_asignacion on the
-- assignment of the progress row.
CREATE OR REPLACE FUNCTION public.get_progreso_detalle(p_progreso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permitido boolean;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'comentarios', '[]'::jsonb,
      'repasos', '[]'::jsonb,
      'clases', '[]'::jsonb
    );
  END IF;

  v_permitido := COALESCE(public.get_user_rol() = 'admin', false)
                 OR (
                   COALESCE(public.get_user_rol() = 'profesor', false)
                   AND public.seg_puede_ver_asignacion(
                     (SELECT mp.asignacion_id FROM public.materia_progreso mp WHERE mp.id = p_progreso_id)
                   )
                 )
                 OR public.seg_alumno_ve_progreso(p_progreso_id);

  IF NOT v_permitido
     OR NOT EXISTS (SELECT 1 FROM public.materia_progreso mp WHERE mp.id = p_progreso_id) THEN
    RETURN jsonb_build_object(
      'comentarios', '[]'::jsonb,
      'repasos', '[]'::jsonb,
      'clases', '[]'::jsonb
    );
  END IF;

  SELECT jsonb_build_object(
    'comentarios', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'texto', c.texto,
          'created_by', c.created_by,
          'autor_nombre', NULLIF(btrim(COALESCE(pc.nombre, '') || ' ' || COALESCE(pc.apellido, '')), ''),
          'created_at', c.created_at,
          'edited_at', c.edited_at
        )
        ORDER BY c.created_at, c.id
      )
      FROM public.materia_progreso_comentarios c
      LEFT JOIN public.profiles pc ON pc.id = c.created_by
      WHERE c.progreso_id = p_progreso_id
    ), '[]'::jsonb),
    'repasos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'fecha', r.fecha,
          'nota', r.nota,
          'created_by', r.created_by,
          'autor_nombre', NULLIF(btrim(COALESCE(pr.nombre, '') || ' ' || COALESCE(pr.apellido, '')), ''),
          'created_at', r.created_at
        )
        ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
      )
      FROM public.materia_progreso_repasos r
      LEFT JOIN public.profiles pr ON pr.id = r.created_by
      WHERE r.progreso_id = p_progreso_id
    ), '[]'::jsonb),
    'clases', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', k.id,
          'horario_id', k.horario_id,
          'titulo', h.titulo,
          'fecha', h.fecha,
          'hora_inicio', h.hora_inicio,
          'activo', h.activo
        )
        ORDER BY h.fecha DESC, h.hora_inicio DESC, k.id DESC
      )
      FROM public.materia_progreso_clases k
      JOIN public.horarios h ON h.id = k.horario_id
      WHERE k.progreso_id = p_progreso_id
    ), '[]'::jsonb)
  )
  INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.get_progreso_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_progreso_detalle(uuid) TO authenticated;

-- get_asignacion_materias_inactivas: admin, or profesor allowed to see the
-- assignee of the assignment.
CREATE OR REPLACE FUNCTION public.get_asignacion_materias_inactivas(p_asignacion_id uuid)
RETURNS TABLE (
  materia_id     uuid,
  codigo         text,
  nombre         text,
  nivel          integer,
  parent_id      uuid,
  estado         text,
  fecha_cubierta date,
  repasos        integer,
  comentarios    integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id,
         m.codigo::text,
         m.nombre::text,
         m.nivel::integer,
         m.parent_id,
         mp.estado::text,
         mp.fecha_cubierta,
         COALESCE(r.n, 0)::integer,
         COALESCE(c.n, 0)::integer
  FROM public.materia_progreso mp
  JOIN public.materias m ON m.id = mp.materia_id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_repasos x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) r ON r.progreso_id = mp.id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_comentarios x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) c ON c.progreso_id = mp.id
  WHERE mp.asignacion_id = p_asignacion_id
    AND NOT m.activo
    AND auth.uid() IS NOT NULL
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
    AND (
      public.get_user_rol() = 'admin'
      OR public.seg_puede_ver_asignacion(p_asignacion_id)
    )
  ORDER BY m.codigo, m.nombre, m.id;
$$;

REVOKE ALL ON FUNCTION public.get_asignacion_materias_inactivas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asignacion_materias_inactivas(uuid) TO authenticated;

-- get_asignacion_actividad: a profesor also needs seg_puede_ver_asignacion.
CREATE OR REPLACE FUNCTION public.get_asignacion_actividad(
  p_asignacion_id     uuid,
  p_limit             integer     DEFAULT 50,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  cedulario_id      uuid,
  tabla             text,
  registro_id       uuid,
  registro_etiqueta text,
  campo             text,
  valor_anterior    jsonb,
  valor_nuevo       jsonb,
  usuario_id        uuid,
  metadata          jsonb,
  created_at        timestamptz,
  usuario_nombre    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_rol    text;
  v_limite integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_rol := public.get_user_rol()::text;

  IF v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RETURN;
  END IF;

  IF v_rol <> 'admin' AND NOT public.seg_puede_ver_asignacion(p_asignacion_id) THEN
    RETURN;
  END IF;

  IF v_rol <> 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.cedulario_asignaciones a
    JOIN public.cedularios c ON c.id = a.cedulario_id
    WHERE a.id = p_asignacion_id
      AND c.activo
  ) THEN
    RETURN;
  END IF;

  v_limite := CASE
    WHEN p_limit IS NULL OR p_limit < 1 THEN 50
    ELSE least(p_limit, 100)
  END;

  RETURN QUERY
  SELECT h.id,
         h.cedulario_id,
         h.tabla,
         h.registro_id,
         h.registro_etiqueta,
         h.campo,
         h.valor_anterior,
         h.valor_nuevo,
         h.usuario_id,
         h.metadata,
         h.created_at,
         NULLIF(btrim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '')
  FROM public.historial_cambios h
  LEFT JOIN public.profiles p ON p.id = h.usuario_id
  WHERE (h.metadata ->> 'asignacion_id')::uuid = p_asignacion_id
    AND h.metadata ->> 'asignacion_id' IS NOT NULL
    AND (
      p_cursor_created_at IS NULL
      OR (p_cursor_id IS NULL AND h.created_at < p_cursor_created_at)
      OR (p_cursor_id IS NOT NULL AND (h.created_at, h.id) < (p_cursor_created_at, p_cursor_id))
    )
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.get_asignacion_actividad(uuid, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asignacion_actividad(uuid, integer, timestamptz, uuid) TO authenticated;

-- =============================================================================
-- SECTION 4: SUMMARY RPCs WITH THE ASSIGNEE ROL
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_alumno_cedularios_resumen: as in 154, for any visible assignee (alumno,
-- profesor or admin) and with alumno_rol.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_alumno_cedularios_resumen(uuid, boolean);

CREATE FUNCTION public.get_alumno_cedularios_resumen(
  p_alumno_id            uuid,
  p_incluir_desasignadas boolean DEFAULT false
)
RETURNS TABLE (
  alumno_id               uuid,
  alumno_nombre           text,
  alumno_apellido         text,
  alumno_apellido_materno text,
  alumno_email            text,
  alumno_avatar_url       text,
  alumno_activo           boolean,
  puede_editar            boolean,
  asignacion_id           uuid,
  cedulario_id            uuid,
  cedulario_nombre        text,
  cedulario_version       text,
  cedulario_activo        boolean,
  universidad_id          uuid,
  universidad_nombre      text,
  estado                  text,
  asignado_at             timestamptz,
  desasignado_at          timestamptz,
  total_asignadas         integer,
  total_cubiertas         integer,
  porcentaje              integer,
  ultima_actividad        timestamptz,
  alumno_rol              text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         p.nombre::text,
         p.apellido::text,
         p.apellido_materno::text,
         p.email::text,
         p.avatar_url::text,
         p.activo,
         public.puede_gestionar_seguimiento_alumno(p.id),
         a.id,
         a.cedulario_id,
         c.nombre::text,
         c.version::text,
         CASE WHEN a.id IS NULL THEN NULL ELSE COALESCE(c.activo, false) END,
         c.universidad_id,
         u.nombre::text,
         a.estado::text,
         a.asignado_at,
         a.desasignado_at,
         CASE WHEN a.id IS NULL THEN NULL ELSE t.total_asignadas END,
         CASE WHEN a.id IS NULL THEN NULL ELSE t.total_cubiertas END,
         CASE
           WHEN a.id IS NULL OR t.total_asignadas = 0 THEN NULL
           ELSE round(100.0 * t.total_cubiertas / t.total_asignadas)::integer
         END,
         act.ultima,
         p.rol::text
  FROM public.profiles p
  LEFT JOIN public.cedulario_asignaciones a
    ON a.alumno_id = p.id
   AND (
     a.estado = 'activa'
     OR (
       COALESCE(p_incluir_desasignadas, false)
       AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
     )
   )
  LEFT JOIN public.cedularios c ON c.id = a.cedulario_id
  LEFT JOIN public.universidades u ON u.id = c.universidad_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS total_asignadas,
           (count(*) FILTER (WHERE mp.estado = 'cubierta'))::integer AS total_cubiertas
    FROM public.materia_progreso mp
    JOIN public.materias m ON m.id = mp.materia_id
    WHERE mp.asignacion_id = a.id
      AND mp.asignada
      AND m.activo
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima
    FROM public.historial_cambios h
    WHERE (h.metadata ->> 'asignacion_id')::uuid = a.id
      AND h.metadata ->> 'asignacion_id' IS NOT NULL
  ) act ON true
  WHERE p.id = p_alumno_id
    AND p.rol IN ('alumno', 'profesor', 'admin')
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor', 'alumno'), false)
    AND public.seg_puede_ver_asignatario(p.id)
  ORDER BY a.estado, c.nombre, a.id;
$$;

REVOKE ALL ON FUNCTION public.get_alumno_cedularios_resumen(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_alumno_cedularios_resumen(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_cedulario_alumnos_resumen: as in 154, for any visible assignee with an
-- activa assignment, and with alumno_rol.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_cedulario_alumnos_resumen(uuid, text, integer, integer);

CREATE FUNCTION public.get_cedulario_alumnos_resumen(
  p_cedulario_id uuid,
  p_q            text    DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  asignacion_id    uuid,
  alumno_id        uuid,
  nombre           text,
  apellido         text,
  apellido_materno text,
  email            text,
  avatar_url       text,
  alumno_activo    boolean,
  asignado_at      timestamptz,
  ultima_actividad timestamptz,
  total_asignadas  integer,
  total_cubiertas  integer,
  porcentaje       integer,
  puede_editar     boolean,
  total_filas      bigint,
  alumno_rol       text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT a.id AS b_asignacion_id,
           p.id AS b_alumno_id,
           p.nombre AS b_nombre,
           p.apellido AS b_apellido,
           p.apellido_materno AS b_apellido_materno,
           p.email AS b_email,
           p.avatar_url AS b_avatar_url,
           p.activo AS b_alumno_activo,
           p.rol AS b_alumno_rol,
           a.asignado_at AS b_asignado_at,
           count(*) OVER () AS b_total
    FROM public.cedulario_asignaciones a
    JOIN public.profiles p
      ON p.id = a.alumno_id
     AND p.rol IN ('alumno', 'profesor', 'admin')
     AND public.seg_puede_ver_asignatario(p.id)
    WHERE a.cedulario_id = p_cedulario_id
      AND a.estado = 'activa'
      AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
      AND (
        public.seg_like_patron(p_q) IS NULL
        OR p.nombre ILIKE public.seg_like_patron(p_q)
        OR p.apellido ILIKE public.seg_like_patron(p_q)
        OR concat_ws(' ', p.nombre, p.apellido) ILIKE public.seg_like_patron(p_q)
        OR p.email ILIKE public.seg_like_patron(p_q)
      )
    ORDER BY p.apellido, p.nombre, p.id
    LIMIT CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 50 ELSE least(p_limit, 100) END
    OFFSET greatest(COALESCE(p_offset, 0), 0)
  )
  SELECT b.b_asignacion_id,
         b.b_alumno_id,
         b.b_nombre::text,
         b.b_apellido::text,
         b.b_apellido_materno::text,
         b.b_email::text,
         b.b_avatar_url::text,
         b.b_alumno_activo,
         b.b_asignado_at,
         act.ultima,
         t.total_asignadas,
         t.total_cubiertas,
         CASE
           WHEN t.total_asignadas = 0 THEN NULL
           ELSE round(100.0 * t.total_cubiertas / t.total_asignadas)::integer
         END,
         public.puede_gestionar_seguimiento_alumno(b.b_alumno_id),
         b.b_total,
         b.b_alumno_rol::text
  FROM base b
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS total_asignadas,
           (count(*) FILTER (WHERE mp.estado = 'cubierta'))::integer AS total_cubiertas
    FROM public.materia_progreso mp
    JOIN public.materias m ON m.id = mp.materia_id
    WHERE mp.asignacion_id = b.b_asignacion_id
      AND mp.asignada
      AND m.activo
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima
    FROM public.historial_cambios h
    WHERE (h.metadata ->> 'asignacion_id')::uuid = b.b_asignacion_id
      AND h.metadata ->> 'asignacion_id' IS NOT NULL
  ) act ON true
  ORDER BY b.b_apellido, b.b_nombre, b.b_alumno_id;
$$;

REVOKE ALL ON FUNCTION public.get_cedulario_alumnos_resumen(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cedulario_alumnos_resumen(uuid, text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- listar_alumnos_asignables: active assignees the caller can assign a cedulario
-- to (alumnos first, then staff), with rol.
--   - admin: every active alumno, profesor and admin (itself included)
--   - profesor: own alumnos and itself
--   - ORDER BY (rol <> 'alumno'), apellido, nombre, id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.listar_alumnos_asignables(uuid, text, integer, integer);

CREATE FUNCTION public.listar_alumnos_asignables(
  p_cedulario_id uuid    DEFAULT NULL,
  p_q            text    DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  nombre           text,
  apellido         text,
  apellido_materno text,
  email            text,
  avatar_url       text,
  ya_asignado      boolean,
  rol              text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         p.nombre::text,
         p.apellido::text,
         p.apellido_materno::text,
         p.email::text,
         p.avatar_url::text,
         (
           p_cedulario_id IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM public.cedulario_asignaciones a
             WHERE a.cedulario_id = p_cedulario_id
               AND a.alumno_id = p.id
               AND a.estado = 'activa'
           )
         ),
         p.rol::text
  FROM public.profiles p
  WHERE p.rol IN ('alumno', 'profesor', 'admin')
    AND p.activo
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
    AND public.puede_gestionar_seguimiento_alumno(p.id)
    AND (
      public.seg_like_patron(p_q) IS NULL
      OR p.nombre ILIKE public.seg_like_patron(p_q)
      OR p.apellido ILIKE public.seg_like_patron(p_q)
      OR concat_ws(' ', p.nombre, p.apellido) ILIKE public.seg_like_patron(p_q)
      OR p.email ILIKE public.seg_like_patron(p_q)
    )
  ORDER BY (p.rol <> 'alumno'), p.apellido, p.nombre, p.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 50 ELSE least(p_limit, 100) END
  OFFSET greatest(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.listar_alumnos_asignables(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_alumnos_asignables(uuid, text, integer, integer) TO authenticated;

-- =============================================================================
-- SECTION 5: get_cedularios_staff_resumen
-- Active assignments per profesor / admin, for the Profesores list. Admin only
-- (any other role gets no rows). Staff without active assignments are absent.
-- SECURITY INVOKER: RLS lets the admin read every assignment.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cedularios_staff_resumen()
RETURNS TABLE (
  asignatario_id uuid,
  total_activas  integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.alumno_id,
         count(*)::integer
  FROM public.cedulario_asignaciones a
  JOIN public.profiles p ON p.id = a.alumno_id AND p.rol IN ('profesor', 'admin')
  WHERE a.estado = 'activa'
    AND COALESCE(public.get_user_rol() = 'admin', false)
  GROUP BY a.alumno_id;
$$;

REVOKE ALL ON FUNCTION public.get_cedularios_staff_resumen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cedularios_staff_resumen() TO authenticated;

-- =============================================================================
-- END OF 157
-- =============================================================================
