-- ── 073: Fix get_alumno_dashboard ─────────────────────────────────────────────
-- Bug 1: proxima_clase filtraba por h.fecha >= current_date (solo fecha),
--        por lo que clases de hoy cuya hora_fin ya pasó aparecían como próximas.
--        Fix: comparar (h.fecha || 'T' || h.hora_fin)::timestamptz > now()
--
-- Bug 2: proxima_clase no incluía cancellation_deadline_hours del profesor,
--        necesario para mostrar el aviso de plazo al alumno en el dashboard.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alumno_dashboard(p_alumno_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'clases', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT a.id, a.estado, a.nota_alumno, a.nuevo_horario_id,
          json_build_object(
            'id', h.id, 'titulo', h.titulo, 'descripcion', h.descripcion,
            'fecha', h.fecha, 'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin,
            'activo', h.activo,
            'profesor', (
              SELECT json_build_object(
                'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido,
                'avatar_url', p.avatar_url,
                'cancellation_deadline_hours', p.cancellation_deadline_hours
              )
              FROM profiles p WHERE p.id = h.profesor_id
            )
          ) AS horario
        FROM asistencia a
        INNER JOIN horarios h ON h.id = a.horario_id
        WHERE a.alumno_id = p_alumno_id AND h.activo = true
        ORDER BY h.fecha DESC, h.hora_inicio DESC
      ) t
    ),
    'proxima_clase', (
      SELECT row_to_json(t)
      FROM (
        SELECT a.id, a.estado, a.nota_alumno,
          json_build_object(
            'id', h.id, 'titulo', h.titulo, 'fecha', h.fecha,
            'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin,
            'descripcion', h.descripcion,
            'activo', h.activo,
            'profesor', (
              SELECT json_build_object(
                'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido,
                'avatar_url', p.avatar_url,
                'cancellation_deadline_hours', p.cancellation_deadline_hours
              )
              FROM profiles p WHERE p.id = h.profesor_id
            )
          ) AS horario
        FROM asistencia a
        INNER JOIN horarios h ON h.id = a.horario_id
        WHERE a.alumno_id = p_alumno_id
          AND h.activo = true
          -- Comparar datetime completo: clase no terminada aún
          AND (h.fecha::text || 'T' || h.hora_fin::text)::timestamptz > now()
        ORDER BY h.fecha ASC, h.hora_inicio ASC
        LIMIT 1
      ) t
    ),
    'stats', (
      SELECT json_build_object(
        'total', count(*),
        'confirmadas', count(*) FILTER (WHERE a.estado = 'confirmado'),
        'pendientes', count(*) FILTER (WHERE a.estado = 'pendiente'),
        'canceladas', count(*) FILTER (WHERE a.estado = 'cancelado'),
        'no_asistio', count(*) FILTER (WHERE a.estado = 'no_asistio')
      )
      FROM asistencia a
      INNER JOIN horarios h ON h.id = a.horario_id
      WHERE a.alumno_id = p_alumno_id AND h.activo = true
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alumno_dashboard(uuid) TO authenticated;
