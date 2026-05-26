-- Migration 033: Create get_alumnos_admin RPC function
-- Replaces 4 sequential queries (profiles, alumnos_extra, profiles[profesores], invitations)
-- with a single optimized SQL query using a CTE for pending invitations (O(1) instead of O(N)).

CREATE OR REPLACE FUNCTION get_alumnos_admin(
  p_q TEXT DEFAULT NULL,
  p_profesor_id UUID DEFAULT NULL,
  p_estado TEXT DEFAULT NULL
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
  profesor_id UUID,
  profesor_nombre TEXT,
  profesor_apellido TEXT,
  universidad TEXT,
  año_ingreso TEXT,
  notas TEXT,
  paso_prueba BOOLEAN,
  fecha_prueba DATE,
  estado TEXT
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
    ae.profesor_id,
    prof.nombre  AS profesor_nombre,
    prof.apellido AS profesor_apellido,
    ae.universidad,
    ae.año_ingreso,
    ae.notas,
    COALESCE(ae.paso_prueba, false) AS paso_prueba,
    ae.fecha_prueba,
    CASE
      WHEN NOT p.activo                          THEN 'bloqueado'
      WHEN COALESCE(ae.paso_prueba, false)       THEN 'graduado'
      WHEN pu.user_id IS NOT NULL                THEN 'pendiente'
      ELSE 'activo'
    END AS estado
  FROM profiles p
  LEFT JOIN alumnos_extra    ae   ON ae.alumno_id = p.id
  LEFT JOIN profiles         prof ON prof.id = ae.profesor_id
  LEFT JOIN pending_users    pu   ON pu.user_id = p.id
  WHERE
    p.rol = 'alumno'
    AND (p_q IS NULL OR (
          p.nombre  ILIKE '%' || p_q || '%'
       OR p.apellido ILIKE '%' || p_q || '%'
       OR p.email    ILIKE '%' || p_q || '%'
    ))
    AND (p_profesor_id IS NULL OR ae.profesor_id = p_profesor_id)
    AND (
      p_estado IS NULL
      OR (p_estado = 'bloqueado'  AND NOT p.activo)
      OR (p_estado = 'graduado'   AND COALESCE(ae.paso_prueba, false))
      OR (p_estado = 'pendiente'  AND p.activo AND NOT COALESCE(ae.paso_prueba, false) AND pu.user_id IS NOT NULL)
      OR (p_estado = 'activo'     AND p.activo AND NOT COALESCE(ae.paso_prueba, false) AND pu.user_id IS NULL)
    )
  ORDER BY p.nombre;
$$;
