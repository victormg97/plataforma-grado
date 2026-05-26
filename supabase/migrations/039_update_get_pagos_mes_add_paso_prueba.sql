-- Migration 039: Update get_pagos_mes to include paso_prueba field
-- Needed to separate graduated students in the pagos tracking view.

DROP FUNCTION IF EXISTS get_pagos_mes(integer, integer);

CREATE FUNCTION get_pagos_mes(
  p_año INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  alumno_id UUID,
  nombre TEXT,
  apellido TEXT,
  avatar_url TEXT,
  activo BOOLEAN,
  paso_prueba BOOLEAN,
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
    COALESCE(ae.paso_prueba, false) AS paso_prueba,
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
