-- =============================================================================
-- 156_establecer_estado_materias_lote.sql
--
-- Batch coverage of the per-student cedulario tracking (parent / child cascade).
--
-- establecer_estado_materias(p_asignacion_id, p_cubiertas, p_pendientes):
--   - sets the DESIRED coverage of several progress rows of ONE assignment in a
--     single transaction: every row of p_cubiertas becomes 'cubierta', every
--     row of p_pendientes becomes 'pendiente'
--   - absolute and idempotent: each UPDATE only touches rows whose state differs
--     from the target, so repeating the call changes nothing and writes no audit
--   - 'cubierta' keeps the date of a row that already had one, or uses today
--     (platform time zone, seguimiento_hoy()); 'pendiente' clears the date
--   - archived rows (asignada = false) and rows of other assignments are ignored
--   - 23514 seguimiento.lote_invalido when an id is repeated (inside or across
--     both arrays) or the batch has more than 500 ids
--   - 42501 seguimiento.sin_permisos when the assignment does not exist or the
--     caller cannot manage the student
--   - the guard trigger (seg_progreso_guard, migration 154) applies CD011,
--     CD012, CD014 and CD015 and fills cubierta_por / cubierta_at per row; any
--     exception rolls back the whole batch (atomic)
--   - the audit trigger (seguimiento_audit, migration 154) fires per row, so the
--     activity tab gets one entry per changed column, same as the single RPC
--   - returns the number of rows changed
--
-- SECURITY INVOKER (same as establecer_estado_materia): RLS of materia_progreso
-- applies to both UPDATEs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.establecer_estado_materias(
  p_asignacion_id uuid,
  p_cubiertas     uuid[],
  p_pendientes    uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cubiertas  uuid[] := COALESCE(p_cubiertas, '{}'::uuid[]);
  v_pendientes uuid[] := COALESCE(p_pendientes, '{}'::uuid[]);
  v_todos      uuid[];
  v_alumno     uuid;
  v_filas      integer;
  v_total      integer := 0;
BEGIN
  v_todos := v_cubiertas || v_pendientes;

  IF cardinality(v_todos) > 500
     OR array_position(v_todos, NULL) IS NOT NULL
     OR cardinality(v_todos) <> (SELECT count(DISTINCT x) FROM unnest(v_todos) AS t(x)) THEN
    RAISE EXCEPTION 'seguimiento.lote_invalido' USING ERRCODE = '23514';
  END IF;

  SELECT a.alumno_id INTO v_alumno
  FROM public.cedulario_asignaciones a
  WHERE a.id = p_asignacion_id;

  IF v_alumno IS NULL
     OR (auth.uid() IS NOT NULL
         AND NOT public.puede_gestionar_seguimiento_alumno(v_alumno)) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_todos) = 0 THEN
    RETURN 0;
  END IF;

  IF cardinality(v_cubiertas) > 0 THEN
    UPDATE public.materia_progreso mp
    SET estado = 'cubierta',
        fecha_cubierta = COALESCE(mp.fecha_cubierta, public.seguimiento_hoy())
    WHERE mp.asignacion_id = p_asignacion_id
      AND mp.id = ANY (v_cubiertas)
      AND mp.asignada
      AND mp.estado <> 'cubierta';
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_total := v_total + v_filas;
  END IF;

  IF cardinality(v_pendientes) > 0 THEN
    UPDATE public.materia_progreso mp
    SET estado = 'pendiente',
        fecha_cubierta = NULL
    WHERE mp.asignacion_id = p_asignacion_id
      AND mp.id = ANY (v_pendientes)
      AND mp.asignada
      AND mp.estado <> 'pendiente';
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_total := v_total + v_filas;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.establecer_estado_materias(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establecer_estado_materias(uuid, uuid[], uuid[]) TO authenticated;
