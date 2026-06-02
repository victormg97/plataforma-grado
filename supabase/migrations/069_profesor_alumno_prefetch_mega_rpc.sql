-- ─────────────────────────────────────────────────────────────────
-- 069: Mega RPCs — get_profesor_prefetch y get_alumno_prefetch
-- Una sola llamada por rol para seed el cache del cliente.
-- ─────────────────────────────────────────────────────────────────

-- ── get_profesor_prefetch ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profesor_prefetch(p_profesor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start  DATE := date_trunc('week', current_date)::date;
  v_week_end    DATE := date_trunc('week', current_date)::date + 6;
  v_horarios    JSONB;
  v_stats       JSONB;
  v_alumnos_cal JSONB;
  v_mis_alumnos JSONB;
  v_programas   JSONB;
  v_recursos    JSONB;
BEGIN
  -- 1a. Horarios del profesor (para el calendario)
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha ASC, t.hora_inicio ASC), '[]'::jsonb)
  INTO v_horarios
  FROM (
    SELECT h.*,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'estado', a.estado, 'nota_alumno', a.nota_alumno)), '[]'::jsonb)
       FROM asistencia a WHERE a.horario_id = h.id) AS asistencia,
      (SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email, 'avatar_url', p.avatar_url)
       FROM profiles p WHERE p.id = h.alumno_id) AS alumno
    FROM horarios h
    WHERE h.profesor_id = p_profesor_id AND h.activo = true
  ) t;

  -- 1b. Stats semanales del profesor
  SELECT jsonb_build_object(
    'total',       count(*),
    'pendientes',  count(*) FILTER (WHERE sub.estado = 'pendiente'),
    'confirmadas', count(*) FILTER (WHERE sub.estado = 'confirmado'),
    'canceladas',  count(*) FILTER (WHERE sub.estado = 'cancelado')
  )
  INTO v_stats
  FROM (
    SELECT COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1), 'pendiente') AS estado
    FROM horarios h
    WHERE h.profesor_id = p_profesor_id AND h.activo = true
      AND h.fecha BETWEEN v_week_start AND v_week_end
  ) sub;

  -- 1c. Alumnos del profesor (shape simple para el calendario)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido,
    'email', p.email, 'avatar_url', p.avatar_url
  ) ORDER BY p.nombre), '[]'::jsonb)
  INTO v_alumnos_cal
  FROM profiles p
  INNER JOIN alumnos_extra ae ON ae.alumno_id = p.id
  WHERE ae.profesor_id = p_profesor_id AND p.activo = true;

  -- 2. Mis alumnos (página mis-alumnos, shape completo con alumnos_extra)
  WITH pending_users AS (
    SELECT DISTINCT user_id FROM invitations WHERE used = false AND expires_at > now()
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(sub) ORDER BY sub.nombre), '[]'::jsonb)
  INTO v_mis_alumnos
  FROM (
    SELECT
      p.id, p.nombre, p.apellido, p.apellido_materno, p.email, p.telefono,
      p.avatar_url, p.activo, p.rol::TEXT AS rol,
      ae.alumno_id, ae.profesor_id, ae.universidad, ae.año_ingreso, ae.año_egreso,
      ae.notas, COALESCE(ae.paso_prueba, false) AS paso_prueba, ae.fecha_prueba,
      COALESCE(ae.ha_dado_examen, false) AS ha_dado_examen, ae.intentos_prueba,
      CASE WHEN pu.user_id IS NOT NULL THEN 'Pendiente' ELSE 'Activo' END AS estado_cuenta
    FROM profiles p
    INNER JOIN alumnos_extra ae ON ae.alumno_id = p.id
    LEFT JOIN pending_users pu ON pu.user_id = p.id
    WHERE p.rol = 'alumno' AND p.activo = true AND ae.profesor_id = p_profesor_id
  ) sub;

  -- 3. Programas activos visibles para el profesor
  SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  INTO v_programas
  FROM (
    SELECT
      pc.id, pc.nombre, pc.descripcion, pc.estado, pc.visibilidad,
      pc.profesor_id, pc.created_by, pc.created_at, pc.updated_at,
      CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id', pr.id, 'nombre', pr.nombre, 'apellido', pr.apellido, 'avatar_url', pr.avatar_url) ELSE NULL END AS profesor,
      CASE WHEN cb.id IS NOT NULL THEN jsonb_build_object('id', cb.id, 'nombre', cb.nombre, 'apellido', cb.apellido) ELSE NULL END AS creado_por,
      (SELECT count(*) FROM clases_programa cp WHERE cp.programa_id = pc.id)::int AS total_clases,
      (SELECT count(*) FROM asignaciones_programa ap WHERE ap.programa_id = pc.id AND ap.estado = 'activo')::int AS total_asignados,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pp_pr.id, 'nombre', pp_pr.nombre, 'apellido', pp_pr.apellido, 'avatar_url', pp_pr.avatar_url)), '[]'::jsonb)
       FROM programa_profesores pp JOIN profiles pp_pr ON pp_pr.id = pp.profesor_id WHERE pp.programa_id = pc.id) AS profesores_asignados
    FROM programas_clases pc
    LEFT JOIN profiles pr ON pr.id = pc.profesor_id
    LEFT JOIN profiles cb ON cb.id = pc.created_by
    WHERE pc.estado = 'activo'
      AND (pc.profesor_id = p_profesor_id
           OR pc.visibilidad = 'todos'
           OR EXISTS (SELECT 1 FROM programa_profesores pp WHERE pp.programa_id = pc.id AND pp.profesor_id = p_profesor_id))
    ORDER BY pc.created_at DESC
  ) sub;

  -- 4. Recursos
  v_recursos := get_recursos_for_user();

  RETURN jsonb_build_object(
    'horarios',    jsonb_build_object('horarios', v_horarios, 'stats', v_stats, 'alumnos', v_alumnos_cal),
    'mis_alumnos', v_mis_alumnos,
    'programas',   v_programas,
    'recursos',    v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profesor_prefetch(UUID) TO authenticated;


-- ── get_alumno_prefetch ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alumno_prefetch(p_alumno_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asistencia JSONB;
  v_recursos   JSONB;
BEGIN
  -- 1. Dashboard del alumno — mismo shape que get_alumno_dashboard
  SELECT jsonb_build_object(
    'clases', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', a.id, 'estado', a.estado, 'nota_alumno', a.nota_alumno, 'nuevo_horario_id', a.nuevo_horario_id,
          'horario', jsonb_build_object(
            'id', h.id, 'titulo', h.titulo, 'descripcion', h.descripcion,
            'fecha', h.fecha, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin, 'activo', h.activo,
            'profesor', (SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'avatar_url', p.avatar_url)
                         FROM profiles p WHERE p.id = h.profesor_id)
          )
        ) ORDER BY h.fecha DESC, h.hora_inicio DESC
      ), '[]'::jsonb)
      FROM asistencia a
      INNER JOIN horarios h ON h.id = a.horario_id
      WHERE a.alumno_id = p_alumno_id
    ),
    'proxima_clase', (
      SELECT to_jsonb(t)
      FROM (
        SELECT a.id, a.estado, a.nota_alumno,
          jsonb_build_object(
            'id', h.id, 'titulo', h.titulo, 'fecha', h.fecha,
            'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin, 'descripcion', h.descripcion,
            'profesor', (SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido)
                         FROM profiles p WHERE p.id = h.profesor_id)
          ) AS horario
        FROM asistencia a
        INNER JOIN horarios h ON h.id = a.horario_id
        WHERE a.alumno_id = p_alumno_id AND h.activo = true AND h.fecha >= current_date
        ORDER BY h.fecha ASC, h.hora_inicio ASC
        LIMIT 1
      ) t
    ),
    'stats', (
      SELECT jsonb_build_object(
        'total',       count(*),
        'confirmadas', count(*) FILTER (WHERE a.estado = 'confirmado'),
        'pendientes',  count(*) FILTER (WHERE a.estado = 'pendiente'),
        'canceladas',  count(*) FILTER (WHERE a.estado = 'cancelado'),
        'no_asistio',  count(*) FILTER (WHERE a.estado = 'no_asistio')
      )
      FROM asistencia a
      INNER JOIN horarios h ON h.id = a.horario_id
      WHERE a.alumno_id = p_alumno_id AND h.activo = true
    )
  ) INTO v_asistencia;

  -- 2. Recursos
  v_recursos := get_recursos_for_user();

  RETURN jsonb_build_object(
    'asistencia', v_asistencia,
    'recursos',   v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alumno_prefetch(UUID) TO authenticated;
