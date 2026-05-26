-- Migration 035: Create get_alumnos_profesor RPC function
-- Replaces 3 sequential queries (alumnos_extra ids, profiles+extra join, invitations)
-- with a single optimized SQL query using a CTE for pending invitations.

CREATE OR REPLACE FUNCTION get_alumnos_profesor(
  p_profesor_id UUID,
  p_scope TEXT DEFAULT 'mis'  -- 'mis' | 'todos'
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  apellido TEXT,
  apellido_materno TEXT,
  email TEXT,
  telefono TEXT,
  avatar_url TEXT,
  activo BOOLEAN,
  rol TEXT,
  -- alumnos_extra fields
  alumno_id UUID,
  profesor_id UUID,
  universidad TEXT,
  año_ingreso TEXT,
  notas TEXT,
  paso_prueba BOOLEAN,
  fecha_prueba DATE,
  ha_dado_examen BOOLEAN,
  intentos_prueba INTEGER,
  -- computed
  estado_cuenta TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH pending_users AS (
    SELECT DISTINCT user_id
    FROM invitations
    WHERE used = false AND expires_at > now()
  )
  SELECT
    p.id,
    p.nombre,
    p.apellido,
    p.apellido_materno,
    p.email,
    p.telefono,
    p.avatar_url,
    p.activo,
    p.rol::TEXT,
    ae.alumno_id,
    ae.profesor_id,
    ae.universidad,
    ae.año_ingreso,
    ae.notas,
    COALESCE(ae.paso_prueba, false)    AS paso_prueba,
    ae.fecha_prueba,
    COALESCE(ae.ha_dado_examen, false) AS ha_dado_examen,
    ae.intentos_prueba,
    CASE
      WHEN pu.user_id IS NOT NULL THEN 'Pendiente'
      ELSE 'Activo'
    END AS estado_cuenta
  FROM profiles p
  INNER JOIN alumnos_extra ae ON ae.alumno_id = p.id
  LEFT JOIN  pending_users pu ON pu.user_id  = p.id
  WHERE
    p.rol    = 'alumno'
    AND p.activo = true
    AND (p_scope = 'todos' OR ae.profesor_id = p_profesor_id)
  ORDER BY p.nombre;
$$;
