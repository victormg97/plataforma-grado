-- Migration 036: Create get_pagos_mes RPC function
-- Replaces 4 sequential queries (profiles, alumnos_extra, profiles[profesores], pagos)
-- with a single SQL query using LEFT JOINs.

CREATE OR REPLACE FUNCTION get_pagos_mes(
  p_año INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  alumno_id UUID,
  nombre TEXT,
  apellido TEXT,
  avatar_url TEXT,
  activo BOOLEAN,
  profesor_id UUID,
  profesor_nombre TEXT,
  profesor_apellido TEXT,
  pago_id UUID,
  pago_estado TEXT,
  pago_monto INTEGER,
  pago_fecha TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id            AS alumno_id,
    p.nombre,
    p.apellido,
    p.avatar_url,
    p.activo,
    ae.profesor_id,
    prof.nombre     AS profesor_nombre,
    prof.apellido   AS profesor_apellido,
    pg.id           AS pago_id,
    pg.estado       AS pago_estado,
    pg.monto_pagado AS pago_monto,
    pg.fecha_pago   AS pago_fecha
  FROM profiles p
  LEFT JOIN alumnos_extra ae   ON ae.alumno_id = p.id
  LEFT JOIN profiles      prof ON prof.id = ae.profesor_id
  LEFT JOIN pagos         pg   ON pg.alumno_id = p.id
                               AND pg.anio = p_año
                               AND pg.mes  = p_mes
  WHERE p.rol = 'alumno'
  ORDER BY p.nombre;
$$;
