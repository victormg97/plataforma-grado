-- ============================================================
-- Migración 111: RPC atómico de Entrada_Personal de un Alumno
-- ============================================================
-- Slice `solapamiento` -> función única que valida el Solapamiento
--                         y persiste la Entrada_Personal en la
--                         misma transacción (Requisito 17.12)
--
-- Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 9.10,
--             10.10, 14.11, 14.13, 14.14, 16.1, 17.12
--
-- COMPLETAMENTE IDEMPOTENTE Y CONVERGENTE — segura de correr
-- múltiples veces. El par `DROP FUNCTION IF EXISTS` (con la
-- firma completa) + `CREATE OR REPLACE FUNCTION` garantiza que
-- una segunda ejecución deje exactamente el mismo objeto y
-- reemplace cualquier versión previa del cuerpo, incluso si esa
-- versión tenía otros nombres de parámetro o otros valores por
-- defecto —caso en el que un `CREATE OR REPLACE` a secas
-- fallaría— (Requisito 1.8). Los `REVOKE`/`GRANT` posteriores
-- reponen los privilegios que el `DROP` se lleva.
-- Sin literales de tenant: aplicable tal cual a cualquier
-- despliegue (Requisito 16.1).
-- ============================================================

-- ── Guarda de dependencias (Requisito 16.2) ─────────────────
-- Primera sentencia del archivo: aborta antes de crear nada si
-- las migraciones 108 y 110 no se aplicaron, de modo que un
-- despliegue incompleto no quede con un RPC que no compila en
-- tiempo de ejecución.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public'
                   AND p.proname = 'agenda_recibe_actividad') THEN
    RAISE EXCEPTION 'Dependencia ausente: función public.agenda_recibe_actividad (aplica 110 primero)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'agenda_eventos') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.agenda_eventos (aplica 108 primero)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'horarios') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.horarios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'asistencia') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.asistencia';
  END IF;
END $$;

-- ============================================================
-- SLICE solapamiento — persistencia atómica de la
-- Entrada_Personal de un Alumno
-- ============================================================
-- El Requisito 6.9 pide que dos solicitudes concurrentes con
-- Solapamiento mutuo no puedan persistir las dos. Leer los
-- Compromisos_Asignados desde el route handler y escribir después
-- deja una ventana entre lectura y escritura: las dos solicitudes
-- leen un estado sin conflicto y las dos escriben. Se cierra
-- reevaluando el Solapamiento dentro de la misma transacción que
-- persiste la fila, con un bloqueo de asesoría por alumno.
--
-- La función es `SECURITY INVOKER`, no `DEFINER`: el Requisito
-- 14.14 exige que toda operación sobre las tablas de agenda se
-- ejecute con las Politicas_RLS del usuario aplicadas. Esta
-- función ESCRIBE filas, así que con `DEFINER` se convertiría en
-- una vía de escalada de privilegios. Con `INVOKER`, el `INSERT`
-- pasa por `agenda_eventos_insert`, el `UPDATE` por
-- `agenda_eventos_update` y la lectura de Actividades por
-- `agenda_eventos_select` (migración 110). Las funciones
-- auxiliares de la 110 sí son `DEFINER`, pero solo devuelven
-- booleanos y no exponen filas.
--
-- Los Usuarios_Editor NO usan esta función: su Solapamiento es
-- siempre advertencia (Requisito 7), así que el slice
-- `entradas-personales` escribe con un INSERT normal y calcula
-- las advertencias aparte, sin bloqueo ni coste de serialización.
-- ============================================================

DROP FUNCTION IF EXISTS public.agenda_guardar_entrada_personal_alumno(
  UUID, TEXT, DATE, TIME, TIME, agenda_categoria, agenda_visibilidad,
  BOOLEAN, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.agenda_guardar_entrada_personal_alumno(
  p_evento_id       UUID,               -- NULL en creación, identificador en edición
  p_titulo          TEXT,
  p_fecha           DATE,
  p_hora_inicio     TIME,
  p_hora_fin        TIME,
  p_categoria       agenda_categoria    DEFAULT 'otro',
  p_visibilidad     agenda_visibilidad  DEFAULT 'privada',
  p_dia_completo    BOOLEAN             DEFAULT FALSE,
  p_descripcion     TEXT                DEFAULT NULL,
  p_nota            TEXT                DEFAULT NULL,
  p_lugar           TEXT                DEFAULT NULL,
  p_enlace_conexion TEXT                DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := (select auth.uid());
  v_inicio       TIME;
  v_fin          TIME;
  v_conflictos   JSONB;
  v_advertencias JSONB;
  v_fila         agenda_eventos;
BEGIN
  -- Requisito 14.11: sin sesión no se escribe nada.
  -- El prefijo `PT` seguido del código de estado es la convención
  -- que PostgREST traduce a ese estado HTTP, así que el código sale
  -- correcto incluso si la llamada llegara por REST directo; y el
  -- route handler no depende de esa traducción: compara
  -- `error.code === 'PT409'` y construye el cuerpo desde el `detail`.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'agenda.sin_sesion' USING ERRCODE = 'PT401';
  END IF;

  -- Requisito 10.10: el día completo fija el rango 00:00–23:59,
  -- ignorando las horas recibidas. `23:59` y no `24:00` porque
  -- TIME no admite `24:00` y así se conserva válida la restricción
  -- `agenda_eventos_rango_valido` de la migración 108.
  IF p_dia_completo THEN
    v_inicio := TIME '00:00';
    v_fin    := TIME '23:59';
  ELSE
    v_inicio := p_hora_inicio;
    v_fin    := p_hora_fin;
  END IF;

  IF v_inicio IS NULL OR v_fin IS NULL OR v_fin <= v_inicio THEN
    RAISE EXCEPTION 'agenda.rango_invalido' USING ERRCODE = 'PT400';
  END IF;

  -- Requisito 6.9: serializa las escrituras concurrentes de ESTE
  -- alumno, y solo de este alumno. Se usa `pg_advisory_xact_lock` y
  -- no `SELECT ... FOR UPDATE` porque no hay una fila «del alumno»
  -- que bloquear, y bloquear `profiles` mezclaría este candado con
  -- flujos ajenos. El bloqueo se libera al terminar la transacción,
  -- sin liberación explícita. Dos alumnos distintos escriben en
  -- paralelo sin contención.
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:' || v_uid::TEXT, 0));

  -- Requisitos 6.1, 6.3, 6.4, 6.5, 6.6, 9.10: Compromisos_Asignados
  -- de la misma fecha en conflicto con el rango solicitado.
  WITH compromisos AS (
    -- Clases activas cuyo estado en `asistencia` no es `cancelado`.
    -- El LEFT JOIN conserva las Clases sin fila de asistencia y el
    -- COALESCE las trata como `pendiente` (Requisito 6.4). La
    -- igualdad por `alumno_id` respeta la clave UNIQUE
    -- (horario_id, alumno_id) y evita duplicar la Clase si alguna
    -- vez existiera más de una fila de asistencia por horario.
    SELECT 'clase'::TEXT AS tipo, h.id, h.titulo, h.fecha,
           h.hora_inicio, h.hora_fin
    FROM horarios h
    LEFT JOIN asistencia a
           ON a.horario_id = h.id
          AND a.alumno_id  = h.alumno_id
    WHERE h.alumno_id = v_uid
      AND h.activo
      AND h.fecha = p_fecha
      AND COALESCE(a.estado::TEXT, 'pendiente') <> 'cancelado'
    UNION ALL
    -- Actividades recibidas, INCLUIDAS las que el alumno tiene
    -- ocultas (Requisito 9.10): la Ocultacion_Alumno es una
    -- preferencia de vista y no altera el veredicto. Por eso esta
    -- rama no consulta `agenda_evento_ocultaciones`.
    -- Requisito 6.6: el día completo se evalúa como 00:00–23:59
    -- aunque la fila almacenara otras horas (red defensiva para
    -- datos llegados por otra vía).
    SELECT 'actividad'::TEXT, e.id, e.titulo, e.fecha,
           CASE WHEN e.dia_completo THEN TIME '00:00' ELSE e.hora_inicio END,
           CASE WHEN e.dia_completo THEN TIME '23:59' ELSE e.hora_fin   END
    FROM agenda_eventos e
    WHERE e.activo
      AND e.fecha = p_fecha
      AND e.alcance <> 'personal'
      AND public.agenda_recibe_actividad(e.id, v_uid)
  ), en_conflicto AS (
    SELECT c.*
    FROM compromisos c
    -- Predicado de Solapamiento del glosario: estricto en los dos
    -- lados, así que los bordes que se tocan no solapan
    -- (Requisito 6.3: 10:00–11:00 y 11:00–12:00 son compatibles).
    WHERE c.hora_inicio < v_fin
      AND c.hora_fin   > v_inicio
    ORDER BY c.fecha, c.hora_inicio
    LIMIT 10                                     -- Requisito 6.2
  )
  SELECT jsonb_agg(jsonb_build_object(
           'tipo', tipo, 'id', id, 'titulo', titulo, 'fecha', fecha,
           'hora_inicio', to_char(hora_inicio, 'HH24:MI'),
           'hora_fin',    to_char(hora_fin,    'HH24:MI')))
  INTO v_conflictos
  FROM en_conflicto;

  -- Requisito 6.2: bloqueo duro dentro de la misma transacción. El
  -- RAISE aborta la transacción, así que el rechazo no deja rastro:
  -- ni fila insertada en la creación, ni fila modificada en la
  -- edición. El DETAIL lleva el JSON de hasta 10 conflictos con
  -- título, fecha y rango horario de cada uno.
  IF v_conflictos IS NOT NULL THEN
    RAISE EXCEPTION 'agenda.solapamiento_bloqueante'
      USING ERRCODE = 'PT409', DETAIL = v_conflictos::TEXT;
  END IF;

  -- Requisito 6.7: advertencia NO bloqueante contra las otras
  -- Entradas_Personales propias del mismo alumno.
  WITH propias AS (
    SELECT e.id, e.titulo, e.fecha,
           CASE WHEN e.dia_completo THEN TIME '00:00' ELSE e.hora_inicio END AS hora_inicio,
           CASE WHEN e.dia_completo THEN TIME '23:59' ELSE e.hora_fin   END AS hora_fin
    FROM agenda_eventos e
    WHERE e.creador_id = v_uid
      AND e.activo
      AND e.alcance = 'personal'
      AND e.fecha = p_fecha
      -- Requisito 6.5: al editar, el propio evento se excluye por
      -- identificador. Sin esta exclusión, editar solo el título
      -- produciría un conflicto consigo mismo.
      AND (p_evento_id IS NULL OR e.id <> p_evento_id)
  ), propias_en_conflicto AS (
    SELECT p.*
    FROM propias p
    WHERE p.hora_inicio < v_fin
      AND p.hora_fin   > v_inicio
    ORDER BY p.fecha, p.hora_inicio
    LIMIT 10                                     -- Requisito 6.7
  )
  SELECT jsonb_agg(jsonb_build_object(
           'tipo', 'entrada_personal', 'id', id, 'titulo', titulo, 'fecha', fecha,
           'hora_inicio', to_char(hora_inicio, 'HH24:MI'),
           'hora_fin',    to_char(hora_fin,    'HH24:MI')))
  INTO v_advertencias
  FROM propias_en_conflicto;

  IF p_evento_id IS NULL THEN
    -- El `creador_id` sale de `auth.uid()` y nunca del cuerpo de la
    -- solicitud (Requisito 14.12). El alcance es siempre `personal`.
    INSERT INTO agenda_eventos (
      creador_id, titulo, descripcion, nota, categoria, alcance, visibilidad,
      fecha, hora_inicio, hora_fin, dia_completo, lugar, enlace_conexion
    ) VALUES (
      v_uid, p_titulo, p_descripcion, p_nota, p_categoria, 'personal', p_visibilidad,
      p_fecha, v_inicio, v_fin, p_dia_completo, p_lugar, p_enlace_conexion
    )
    RETURNING * INTO v_fila;
  ELSE
    UPDATE agenda_eventos e
       SET titulo          = p_titulo,
           descripcion     = p_descripcion,
           nota            = p_nota,
           categoria       = p_categoria,
           visibilidad     = p_visibilidad,
           fecha           = p_fecha,
           hora_inicio     = v_inicio,
           hora_fin        = v_fin,
           dia_completo    = p_dia_completo,
           lugar           = p_lugar,
           enlace_conexion = p_enlace_conexion
     WHERE e.id = p_evento_id
       AND e.activo
       AND e.alcance = 'personal'          -- Requisito 14.13: el alcance no es modificable
       AND e.creador_id = v_uid            -- redundante con la RLS, explícito a propósito
    RETURNING * INTO v_fila;

    -- Requisito 5.11: identificador inexistente, inactivo o ajeno.
    -- Una fila ajena no pasa la RLS y termina aquí igual: cero filas
    -- modificadas y ningún dato alterado.
    IF v_fila.id IS NULL THEN
      RAISE EXCEPTION 'agenda.evento_no_encontrado' USING ERRCODE = 'PT404';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'evento',       to_jsonb(v_fila),
    'advertencias', COALESCE(v_advertencias, '[]'::JSONB)
  );
END;
$$;

COMMENT ON FUNCTION public.agenda_guardar_entrada_personal_alumno(
  UUID, TEXT, DATE, TIME, TIME, agenda_categoria, agenda_visibilidad,
  BOOLEAN, TEXT, TEXT, TEXT, TEXT) IS
  'Slice solapamiento (migración 111): crea o edita la Entrada_Personal de un Alumno reevaluando el Solapamiento contra sus Compromisos_Asignados dentro de la misma transacción (Requisitos 6.1 a 6.9). SECURITY INVOKER: escribe filas y las Politicas_RLS deben aplicarse (Requisito 14.14). Errores: PT401 sin sesión, PT400 rango inválido, PT404 evento no encontrado, PT409 solapamiento bloqueante con el JSON de hasta 10 conflictos en el DETAIL.';

-- ── Privilegios de ejecución ────────────────────────────────
-- `REVOKE ... FROM PUBLIC` no basta en Supabase: los privilegios por
-- defecto del esquema `public` conceden EXECUTE a `anon` de forma
-- explícita, y un privilegio explícito no lo retira el revoke a
-- PUBLIC. Aquí importa más que en la migración 110 porque esta
-- función ESCRIBE: sin el segundo revoke quedaría invocable sin
-- sesión en `/rest/v1/rpc/`. La guarda de `PT401` la dejaría sin
-- efecto, pero el revoke cierra la superficie de todas formas.
-- Ambos revokes son idempotentes: sobre un rol que ya no tiene el
-- privilegio no hacen nada y no levantan error.
REVOKE ALL ON FUNCTION public.agenda_guardar_entrada_personal_alumno(
  UUID, TEXT, DATE, TIME, TIME, agenda_categoria, agenda_visibilidad,
  BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.agenda_guardar_entrada_personal_alumno(
  UUID, TEXT, DATE, TIME, TIME, agenda_categoria, agenda_visibilidad,
  BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.agenda_guardar_entrada_personal_alumno(
  UUID, TEXT, DATE, TIME, TIME, agenda_categoria, agenda_visibilidad,
  BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO authenticated;
