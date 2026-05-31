-- ============================================================
-- 064_extend_admin_stats_rotating.sql
-- Extend get_admin_stats() with extra counts used by the rotating
-- dashboard stat cards (clases por periodo + clases por estado).
--
-- Backwards compatible: only ADDS keys to the returned JSON object.
-- Existing keys (total_alumnos, total_profesores, clases_hoy,
-- pendientes_confirmar) keep the same names and semantics, so
-- lib/supabase/types.ts needs no change (RPC already returns Json).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  week_start date := date_trunc('week', current_date)::date;
  week_end   date := date_trunc('week', current_date)::date + 6;
  month_start date := date_trunc('month', current_date)::date;
  month_end   date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
BEGIN
  SELECT json_build_object(
    'total_alumnos',        (SELECT count(*) FROM profiles WHERE rol = 'alumno' AND activo = true),
    'total_profesores',     (SELECT count(*) FROM profiles WHERE rol = 'profesor' AND activo = true),
    -- Clases por periodo (sobre horarios activos)
    'clases_hoy',           (SELECT count(*) FROM horarios WHERE fecha = current_date AND activo = true),
    'clases_semana',        (SELECT count(*) FROM horarios WHERE fecha BETWEEN week_start AND week_end AND activo = true),
    'clases_mes',           (SELECT count(*) FROM horarios WHERE fecha BETWEEN month_start AND month_end AND activo = true),
    -- Pendientes globales (sin cambios, compatibilidad con el card existente)
    'pendientes_confirmar', (SELECT count(*) FROM asistencia WHERE estado = 'pendiente'),
    -- Clases por estado (sobre horarios activos, una asistencia por horario)
    'estado_pendientes', (
      SELECT count(*) FROM horarios h
      WHERE h.activo = true
        AND COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1), 'pendiente') = 'pendiente'
    ),
    'estado_confirmadas', (
      SELECT count(*) FROM horarios h
      WHERE h.activo = true
        AND (SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1) = 'confirmado'
    ),
    'estado_canceladas', (
      SELECT count(*) FROM horarios h
      WHERE h.activo = true
        AND (SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1) = 'cancelado'
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
