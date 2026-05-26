-- 027_pagos_columna_rpc.sql
-- RPC para marcar/desmarcar todos los pagos de un mes entero en una sola llamada

CREATE OR REPLACE FUNCTION admin_pagar_mes_columna(
  p_anio   integer,
  p_mes    integer,
  p_estado text,           -- 'pagado' | 'parcial' | 'pendiente' (= eliminar)
  p_monto  integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic validation
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'mes debe estar entre 1 y 12';
  END IF;
  IF p_estado NOT IN ('pagado', 'parcial', 'pendiente') THEN
    RAISE EXCEPTION 'estado debe ser pagado, parcial o pendiente';
  END IF;

  IF p_estado = 'pendiente' THEN
    -- Eliminar todos los pagos de ese mes/año
    DELETE FROM pagos WHERE anio = p_anio AND mes = p_mes;
  ELSE
    -- Upsert para todos los alumnos activos
    INSERT INTO pagos (alumno_id, anio, mes, estado, monto_pagado)
    SELECT prof.id, p_anio, p_mes, p_estado, p_monto
    FROM profiles prof
    WHERE prof.rol = 'alumno'
      AND prof.activo = true
    ON CONFLICT (alumno_id, anio, mes)
    DO UPDATE SET
      estado       = EXCLUDED.estado,
      monto_pagado = EXCLUDED.monto_pagado,
      updated_at   = now();
  END IF;
END;
$$;
