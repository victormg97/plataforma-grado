-- Migration 041: Add remaining missing RPC functions (get_profesor_dashboard, get_alumno_ficha)

-- ─────────────────────────────────────────────
-- 1. get_profesor_dashboard
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profesor_dashboard(p_profesor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  week_start date;
  week_end date;
BEGIN
  week_start := date_trunc('week', current_date)::date;
  week_end := week_start + 6;

  SELECT json_build_object(
    'horarios', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT h.*,
          (SELECT json_agg(json_build_object('id', a.id, 'estado', a.estado, 'nota_alumno', a.nota_alumno))
           FROM asistencia a WHERE a.horario_id = h.id) AS asistencia,
          (SELECT json_build_object('id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email, 'avatar_url', p.avatar_url)
           FROM profiles p WHERE p.id = h.alumno_id) AS alumno
        FROM horarios h
        WHERE h.profesor_id = p_profesor_id AND h.activo = true
        ORDER BY h.fecha ASC, h.hora_inicio ASC
      ) t
    ),
    'stats', (
      SELECT json_build_object(
        'total', count(*),
        'pendientes', count(*) FILTER (WHERE sub.estado = 'pendiente'),
        'confirmadas', count(*) FILTER (WHERE sub.estado = 'confirmado'),
        'canceladas', count(*) FILTER (WHERE sub.estado = 'cancelado')
      )
      FROM (
        SELECT COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1), 'pendiente') AS estado
        FROM horarios h
        WHERE h.profesor_id = p_profesor_id AND h.activo = true
          AND h.fecha BETWEEN week_start AND week_end
      ) sub
    ),
    'alumnos', (
      SELECT coalesce(json_agg(json_build_object(
        'id', p.id, 'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email, 'avatar_url', p.avatar_url
      ) ORDER BY p.nombre), '[]'::json)
      FROM profiles p
      INNER JOIN alumnos_extra ae ON ae.alumno_id = p.id
      WHERE ae.profesor_id = p_profesor_id AND p.activo = true
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profesor_dashboard(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 2. get_alumno_ficha
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alumno_ficha(p_alumno_id uuid, p_limit integer DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = p_alumno_id),
    'extra', (SELECT row_to_json(ae) FROM alumnos_extra ae WHERE ae.alumno_id = p_alumno_id),
    'horarios', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT h.id, h.titulo, h.fecha, h.hora_inicio, h.hora_fin, h.descripcion,
          (SELECT json_agg(json_build_object('id', a.id, 'estado', a.estado, 'nota_alumno', a.nota_alumno))
           FROM asistencia a WHERE a.horario_id = h.id) AS asistencia
        FROM horarios h
        WHERE h.alumno_id = p_alumno_id AND h.activo = true
        ORDER BY h.fecha DESC
        LIMIT p_limit
      ) t
    ),
    'stats', (
      SELECT json_build_object(
        'total_clases', count(*),
        'confirmadas', count(*) FILTER (WHERE sub.estado = 'confirmado'),
        'canceladas', count(*) FILTER (WHERE sub.estado = 'cancelado'),
        'tasa_asistencia', CASE WHEN count(*) > 0
          THEN round(100.0 * count(*) FILTER (WHERE sub.estado = 'confirmado') / count(*), 1)
          ELSE 0 END
      )
      FROM (
        SELECT COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1), 'pendiente') AS estado
        FROM horarios h
        WHERE h.alumno_id = p_alumno_id AND h.activo = true
      ) sub
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alumno_ficha(uuid, integer) TO authenticated;
