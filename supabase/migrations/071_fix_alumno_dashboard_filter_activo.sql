-- ── 071: Fix get_alumno_dashboard — filtrar h.activo = true en 'clases' ───────
-- Bug: la subquery 'clases' dentro de get_alumno_dashboard no filtraba
-- h.activo = true, por lo que mostraba clases borradas (activo=false) al alumno.
-- proxima_clase y stats ya filtraban correctamente — solo faltaba en 'clases'.

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
            'profesor', (SELECT json_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'avatar_url', p.avatar_url)
                         FROM profiles p WHERE p.id = h.profesor_id)
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
            'profesor', (SELECT json_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido)
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
