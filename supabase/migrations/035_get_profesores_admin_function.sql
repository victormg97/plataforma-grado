-- Migration 034: Create get_profesores_admin RPC function
-- Replaces 3 sequential queries (profiles, alumnos_extra counts, invitations)
-- with a single optimized SQL query using CTEs.

CREATE OR REPLACE FUNCTION get_profesores_admin()
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
  puede_crear_alumno BOOLEAN,
  alumnos_count BIGINT,
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
  ),
  alumno_counts AS (
    SELECT profesor_id, COUNT(*) AS total
    FROM alumnos_extra
    WHERE profesor_id IS NOT NULL
    GROUP BY profesor_id
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
    p.puede_crear_alumno,
    COALESCE(ac.total, 0) AS alumnos_count,
    CASE
      WHEN pu.user_id IS NOT NULL THEN 'Pendiente'
      ELSE 'Activo'
    END AS estado_cuenta
  FROM profiles p
  LEFT JOIN pending_users  pu ON pu.user_id = p.id
  LEFT JOIN alumno_counts  ac ON ac.profesor_id = p.id
  WHERE p.rol IN ('profesor', 'admin')
  ORDER BY p.nombre;
$$;
