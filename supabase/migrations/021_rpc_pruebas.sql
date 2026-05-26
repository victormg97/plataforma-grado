-- RPC for checking if a test grade edit is locked by the timeline
CREATE OR REPLACE FUNCTION get_is_prueba_locked(p_prueba_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clase_id UUID;
    v_alumno_id UUID;
    v_failed_fecha DATE;
    v_failed_hora TIME;
    v_programa_id UUID;
    v_asig_id UUID;
    v_next_fecha DATE;
    v_next_hora TIME;
    v_now_date DATE;
    v_now_time TIME;
BEGIN
    SELECT p.clase_id, p.alumno_id, h.fecha, h.hora_inicio
    INTO v_clase_id, v_alumno_id, v_failed_fecha, v_failed_hora
    FROM pruebas p
    JOIN horarios h ON p.horario_id = h.id
    WHERE p.id = p_prueba_id AND p.estado = 'calificada';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    SELECT cp.programa_id INTO v_programa_id
    FROM clases_programa cp WHERE cp.id = v_clase_id;

    SELECT id INTO v_asig_id
    FROM asignaciones_programa
    WHERE programa_id = v_programa_id AND alumno_id = v_alumno_id;

    IF v_asig_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT h.fecha, h.hora_inicio
    INTO v_next_fecha, v_next_hora
    FROM horarios_programa hp
    JOIN horarios h ON hp.horario_id = h.id
    WHERE hp.asignacion_id = v_asig_id
      AND (h.fecha > v_failed_fecha OR (h.fecha = v_failed_fecha AND h.hora_inicio > v_failed_hora))
    ORDER BY h.fecha ASC, h.hora_inicio ASC
    LIMIT 1;

    IF v_next_fecha IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Local time estimation for Santiago context (or standard UTC timezone if set on DB)
    -- Using CURRENT_TIMESTAMP directly from Postgres timezone, adjust if needed:
    v_now_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::DATE;
    v_now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::TIME;

    IF (v_now_date > v_next_fecha) OR (v_now_date = v_next_fecha AND v_now_time >= v_next_hora) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
