-- ============================================================
-- Migración 110: RLS de las tablas de agenda
-- ============================================================
-- Slice `visibilidad` -> funciones auxiliares de la matriz del
--                        Requisito 8 + doce Politicas_RLS
--
-- Requisitos: 4.7, 4.9, 4.10, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8,
--             14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8,
--             14.9, 16.1, 17.12
--
-- COMPLETAMENTE IDEMPOTENTE Y CONVERGENTE — segura de correr
-- múltiples veces. `CREATE OR REPLACE FUNCTION` y el par
-- `DROP POLICY IF EXISTS` + `CREATE POLICY` garantizan que una
-- segunda ejecución deje exactamente el mismo conjunto de
-- objetos y, además, reemplace cualquier versión antigua del
-- predicado que hubiera dejado una ejecución previa
-- (Requisito 1.8).
-- Sin literales de tenant: aplicable tal cual a cualquier
-- despliegue (Requisito 16.1).
-- ============================================================

-- ── Guarda de dependencias (Requisito 16.2) ─────────────────
-- Primera sentencia del archivo: aborta antes de crear nada si
-- la migración 108 no se aplicó, de modo que un despliegue
-- incompleto no queda con funciones huérfanas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'agenda_eventos') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.agenda_eventos (aplica 108 primero)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'agenda_evento_destinatarios') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.agenda_evento_destinatarios (aplica 108 primero)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'agenda_evento_ocultaciones') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.agenda_evento_ocultaciones (aplica 108 primero)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'alumnos_extra') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.alumnos_extra';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.profiles';
  END IF;
END $$;

-- ============================================================
-- SLICE visibilidad — funciones auxiliares de la matriz
-- ============================================================
-- Las cuatro son `STABLE SECURITY DEFINER` con `search_path`
-- fijado, y es una decisión deliberada:
--
--   1. Cortan la recursión de RLS. Una política de
--      `agenda_eventos` que consultara `agenda_evento_destinatarios`
--      activaría la RLS de esa tabla, que a su vez consulta
--      `agenda_eventos`. El proyecto ya sufrió ese ciclo en las
--      migraciones 016, 024 y 025, y se resolvió del mismo modo.
--   2. Se reutilizan en las doce políticas, en el RPC de la
--      migración 111 y en las pruebas de RLS, y el planificador
--      puede memorizar su resultado dentro de una misma consulta.
--
-- Ninguna devuelve filas: solo booleanos o texto. Esa es la
-- razón por la que `SECURITY DEFINER` aquí no abre una vía de
-- escalada de privilegios; el RPC de la migración 111, que sí
-- escribe filas, se declara `SECURITY INVOKER`.
-- ============================================================

-- Rol efectivo del usuario, o NULL si el perfil no existe o está inactivo.
CREATE OR REPLACE FUNCTION public.agenda_rol(p_usuario UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.rol::TEXT
  FROM profiles p
  WHERE p.id = p_usuario
    AND p.activo;
$$;

COMMENT ON FUNCTION public.agenda_rol(UUID) IS
  'Slice visibilidad (migración 110): rol efectivo del usuario, NULL si el perfil no existe o está inactivo. SECURITY DEFINER para cortar la recursión de RLS; solo devuelve texto.';

-- Vínculo alumno ↔ profesor evaluado en el instante de la consulta
-- (Requisito 4.8: la Audiencia_Dinamica no se congela).
CREATE OR REPLACE FUNCTION public.agenda_es_alumno_asignado(p_profesor UUID, p_alumno UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM alumnos_extra ae
    JOIN profiles pa ON pa.id = ae.alumno_id
    WHERE ae.alumno_id   = p_alumno
      AND ae.profesor_id = p_profesor
      AND pa.activo
  );
$$;

COMMENT ON FUNCTION public.agenda_es_alumno_asignado(UUID, UUID) IS
  'Slice visibilidad (migración 110): ¿el alumno está asignado a ese profesor ahora mismo? (Requisito 4.8). Se resuelve por idx_alumnos_extra_profesor_alumno.';

-- Destinatario_Explicito o Audiencia_Dinamica (Requisitos 4.7, 4.9, 4.10).
CREATE OR REPLACE FUNCTION public.agenda_recibe_actividad(p_evento_id UUID, p_alumno UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agenda_eventos e
    JOIN profiles autor ON autor.id = e.creador_id
    WHERE e.id = p_evento_id
      AND e.activo
      AND autor.activo                                  -- Requisito 4.7 (autor inactivo)
      AND e.alcance <> 'personal'
      AND (
        -- Destinatario_Explicito: sobrevive a la pérdida del vínculo (Requisito 4.9)
        (e.alcance = 'alumnos_seleccionados' AND EXISTS (
            SELECT 1 FROM agenda_evento_destinatarios d
            WHERE d.evento_id = e.id AND d.alumno_id = p_alumno))
        -- Audiencia_Dinamica: el conjunto son los ALUMNOS activos, no
        -- «cualquier perfil activo». La guarda de rol es imprescindible:
        -- sin ella un `lector` (y cualquier otro rol) recibiría todas las
        -- Actividades de alcance `todos_alumnos` de un Admin, lo que
        -- contradice que la agenda no esté en el alcance del rol `lector`.
        -- `agenda_rol` devuelve NULL para un perfil inactivo, así que el
        -- «activo» del Requisito 4 queda cubierto por la misma expresión.
        OR (e.alcance = 'todos_alumnos'
            AND public.agenda_rol(p_alumno) = 'alumno'
            AND (
              -- Audiencia_Dinamica de un Admin: todos los alumnos activos
              autor.rol::TEXT = 'admin'
              -- Audiencia_Dinamica de un Profesor: sus Alumnos_Asignados de ahora
              OR (autor.rol::TEXT = 'profesor'
                  AND public.agenda_es_alumno_asignado(autor.id, p_alumno))
            ))
      )
  );
$$;

COMMENT ON FUNCTION public.agenda_recibe_actividad(UUID, UUID) IS
  'Slice visibilidad (migración 110): ¿el alumno recibe esa Actividad, por Destinatario_Explicito o por Audiencia_Dinamica? (Requisitos 4.7, 4.9, 4.10). La Audiencia_Dinamica se limita a alumnos activos.';

-- Matriz del Requisito 8 para Entradas_Personales `publica` ajenas.
-- Devuelve false para `lector` y para cualquier rol no contemplado.
-- No contempla el caso «autor = lector»: ese lo resuelve la propia
-- política con `creador_id = (select auth.uid())` (Requisito 8.9).
CREATE OR REPLACE FUNCTION public.agenda_puede_leer_entrada_publica(p_autor UUID, p_lector UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Requisito 8.7: el Admin lee las públicas de cualquier autor
    WHEN public.agenda_rol(p_lector) = 'admin' THEN TRUE
    -- Requisito 8.4: entre Usuarios_Editor, con independencia del rol del autor
    WHEN public.agenda_rol(p_lector) = 'profesor'
     AND public.agenda_rol(p_autor) IN ('admin', 'profesor') THEN TRUE
    -- Requisito 8.6: el Profesor lee las públicas de sus Alumnos_Asignados
    WHEN public.agenda_rol(p_lector) = 'profesor'
     AND public.agenda_rol(p_autor) = 'alumno'
      THEN public.agenda_es_alumno_asignado(p_lector, p_autor)
    -- Requisitos 8.5 y 8.8: el Alumno no lee ninguna Entrada_Personal ajena.
    -- El rol `lector` tampoco: la agenda no está en su alcance.
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.agenda_puede_leer_entrada_publica(UUID, UUID) IS
  'Slice visibilidad (migración 110): matriz del Requisito 8 para Entradas_Personales publica ajenas. FALSE para alumno y para lector.';

-- ── Privilegios de ejecución ────────────────────────────────
-- Las cuatro son de uso interno de las políticas y del RPC de la
-- migración 111. Se revoca a PUBLIC y se concede solo a
-- `authenticated`.
REVOKE ALL ON FUNCTION public.agenda_rol(UUID)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_es_alumno_asignado(UUID, UUID)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_recibe_actividad(UUID, UUID)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_puede_leer_entrada_publica(UUID, UUID) FROM PUBLIC;

-- `REVOKE ... FROM PUBLIC` no basta en Supabase: los privilegios por
-- defecto del esquema `public` conceden EXECUTE a `anon` de forma
-- explícita, y un privilegio explícito no lo retira el revoke a
-- PUBLIC. Sin este segundo revoke las cuatro funciones quedarían
-- invocables sin sesión en `/rest/v1/rpc/`, y `agenda_rol` filtraría
-- el rol de cualquier perfil a un cliente anónimo. El revoke es
-- idempotente: sobre un rol que ya no tiene el privilegio no hace
-- nada y no levanta error.
REVOKE ALL ON FUNCTION public.agenda_rol(UUID)                            FROM anon;
REVOKE ALL ON FUNCTION public.agenda_es_alumno_asignado(UUID, UUID)       FROM anon;
REVOKE ALL ON FUNCTION public.agenda_recibe_actividad(UUID, UUID)         FROM anon;
REVOKE ALL ON FUNCTION public.agenda_puede_leer_entrada_publica(UUID, UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.agenda_rol(UUID)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_es_alumno_asignado(UUID, UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_recibe_actividad(UUID, UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_puede_leer_entrada_publica(UUID, UUID) TO authenticated;

-- ── Índices de soporte de las políticas ─────────────────────
-- `agenda_es_alumno_asignado` se resuelve por índice y no por
-- escaneo secuencial de `alumnos_extra`.
-- La guarda consulta `pg_indexes` en lugar de capturar la excepción:
-- así la migración converge sin depender del SQLSTATE que levante un
-- índice duplicado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname = 'public'
                   AND tablename  = 'alumnos_extra'
                   AND indexname  = 'idx_alumnos_extra_profesor_alumno') THEN
    CREATE INDEX idx_alumnos_extra_profesor_alumno
      ON alumnos_extra (profesor_id, alumno_id);
  END IF;

  -- Sentido inverso: «¿quién es el profesor de este alumno?»
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname = 'public'
                   AND tablename  = 'alumnos_extra'
                   AND indexname  = 'idx_alumnos_extra_alumno_profesor') THEN
    CREATE INDEX idx_alumnos_extra_alumno_profesor
      ON alumnos_extra (alumno_id, profesor_id);
  END IF;
END $$;

-- `agenda_recibe_actividad` entra en destinatarios por
-- (evento_id, alumno_id): lo cubre la restricción UNIQUE
-- `agenda_evento_destinatarios_unico` de la migración 108.
-- La política de SELECT de ocultaciones entra por alumno_id:
-- la cubre `idx_agenda_ocultaciones_alumno` de la migración 108.

-- ============================================================
-- RLS habilitada en las tres tablas (Requisito 14.1)
-- ============================================================
-- `ENABLE ROW LEVEL SECURITY` es idempotente: sobre una tabla que
-- ya la tiene habilitada no hace nada y no levanta error.
ALTER TABLE agenda_eventos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_evento_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_evento_ocultaciones  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas de agenda_eventos (Requisito 14.2: una por operación,
-- ninguna declarada con ALL)
-- ============================================================
-- Todas referencian el usuario autenticado con la forma envuelta
-- `(select auth.uid())` y nunca `auth.uid()` desnudo (Requisito 14.9):
-- la forma envuelta se resuelve como un InitPlan que Postgres evalúa
-- una vez por consulta, no una vez por fila.

-- Requisito 14.3. La política NO filtra por Ocultacion_Alumno: la
-- ocultación es una preferencia de vista, no una regla de acceso, y
-- el Requisito 9.10 exige que las Actividades ocultas sigan contando
-- como Compromiso_Asignado en la validación de Solapamiento. El
-- filtrado por ocultación ocurre en los slices `ocultacion` y
-- `calendario`.
DROP POLICY IF EXISTS "agenda_eventos_select" ON agenda_eventos;
CREATE POLICY "agenda_eventos_select"
  ON agenda_eventos FOR SELECT
  TO authenticated
  USING (
    activo
    AND (
      -- Requisito 8.9: el Autor lee todo lo suyo
      creador_id = (select auth.uid())
      -- Requisitos 4.7 a 4.10: Actividades recibidas
      OR public.agenda_recibe_actividad(id, (select auth.uid()))
      -- Requisito 12.2: el Admin ve todas las Actividades del tenant
      OR (alcance <> 'personal' AND public.agenda_rol((select auth.uid())) = 'admin')
      -- Requisito 8: Entradas_Personales `publica` ajenas según la matriz.
      -- La guarda `visibilidad = 'publica'` va antes que cualquier
      -- consideración de rol, de modo que ni un Admin lee una
      -- Entrada_Personal `privada` ajena (Requisitos 8.3, 14.8).
      OR (alcance = 'personal'
          AND visibilidad = 'publica'
          AND public.agenda_puede_leer_entrada_publica(creador_id, (select auth.uid())))
    )
  );

-- Requisito 14.4: solo filas cuyo creador es el propio usuario.
DROP POLICY IF EXISTS "agenda_eventos_insert" ON agenda_eventos;
CREATE POLICY "agenda_eventos_insert"
  ON agenda_eventos FOR INSERT
  TO authenticated
  WITH CHECK (
    creador_id = (select auth.uid())
    -- Requisito 5.2: un Alumno solo puede crear alcance `personal`
    AND (
      public.agenda_rol((select auth.uid())) IN ('admin', 'profesor')
      OR alcance = 'personal'
    )
  );

-- Requisitos 14.4, 14.5, 14.6: el Autor edita lo suyo; un Admin edita
-- Actividades ajenas pero nunca Entradas_Personales ajenas; un Alumno
-- sobre una fila ajena termina con cero filas modificadas.
DROP POLICY IF EXISTS "agenda_eventos_update" ON agenda_eventos;
CREATE POLICY "agenda_eventos_update"
  ON agenda_eventos FOR UPDATE
  TO authenticated
  USING (
    creador_id = (select auth.uid())
    OR (alcance <> 'personal' AND public.agenda_rol((select auth.uid())) = 'admin')
  )
  WITH CHECK (
    creador_id = (select auth.uid())
    OR (alcance <> 'personal' AND public.agenda_rol((select auth.uid())) = 'admin')
  );

-- Requisitos 14.4, 14.5, 14.6.
DROP POLICY IF EXISTS "agenda_eventos_delete" ON agenda_eventos;
CREATE POLICY "agenda_eventos_delete"
  ON agenda_eventos FOR DELETE
  TO authenticated
  USING (
    creador_id = (select auth.uid())
    OR (alcance <> 'personal' AND public.agenda_rol((select auth.uid())) = 'admin')
  );

-- ============================================================
-- Políticas de agenda_evento_destinatarios
-- ============================================================
-- El Alumno lee las filas que le nombran; el Autor del Evento_Agenda
-- y un Admin leen las de ese evento.
DROP POLICY IF EXISTS "agenda_destinatarios_select" ON agenda_evento_destinatarios;
CREATE POLICY "agenda_destinatarios_select"
  ON agenda_evento_destinatarios FOR SELECT
  TO authenticated
  USING (
    alumno_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM agenda_eventos e
      WHERE e.id = evento_id
        AND (e.creador_id = (select auth.uid())
             OR public.agenda_rol((select auth.uid())) = 'admin')
    )
  );

-- Requisito 14.4: solo destinatarios de un Evento_Agenda propio, y
-- solo cuando ese evento es de alcance `alumnos_seleccionados`.
DROP POLICY IF EXISTS "agenda_destinatarios_insert" ON agenda_evento_destinatarios;
CREATE POLICY "agenda_destinatarios_insert"
  ON agenda_evento_destinatarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agenda_eventos e
      WHERE e.id = evento_id
        AND e.alcance = 'alumnos_seleccionados'
        AND (e.creador_id = (select auth.uid())
             OR public.agenda_rol((select auth.uid())) = 'admin')
    )
  );

-- La API nunca actualiza esta tabla (una edición de destinatarios es
-- DELETE + INSERT), pero el Requisito 14.2 exige una política por
-- operación: sin ella un UPDATE quedaría sin regla explícita.
DROP POLICY IF EXISTS "agenda_destinatarios_update" ON agenda_evento_destinatarios;
CREATE POLICY "agenda_destinatarios_update"
  ON agenda_evento_destinatarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agenda_eventos e
            WHERE e.id = evento_id AND e.creador_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM agenda_eventos e
            WHERE e.id = evento_id AND e.creador_id = (select auth.uid()))
  );

-- Requisito 14.4.
DROP POLICY IF EXISTS "agenda_destinatarios_delete" ON agenda_evento_destinatarios;
CREATE POLICY "agenda_destinatarios_delete"
  ON agenda_evento_destinatarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agenda_eventos e
      WHERE e.id = evento_id
        AND (e.creador_id = (select auth.uid())
             OR public.agenda_rol((select auth.uid())) = 'admin')
    )
  );

-- ============================================================
-- Políticas de agenda_evento_ocultaciones (Requisitos 14.7, 9.7)
-- ============================================================
-- La Ocultacion_Alumno es privada de cada Alumno: nadie más la lee ni
-- la escribe, ni siquiera un Admin.
DROP POLICY IF EXISTS "agenda_ocultaciones_select" ON agenda_evento_ocultaciones;
CREATE POLICY "agenda_ocultaciones_select"
  ON agenda_evento_ocultaciones FOR SELECT
  TO authenticated
  USING (alumno_id = (select auth.uid()));

DROP POLICY IF EXISTS "agenda_ocultaciones_insert" ON agenda_evento_ocultaciones;
CREATE POLICY "agenda_ocultaciones_insert"
  ON agenda_evento_ocultaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    alumno_id = (select auth.uid())
    -- Requisito 9.9: solo sobre Actividades_Recibidas
    AND public.agenda_recibe_actividad(evento_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "agenda_ocultaciones_update" ON agenda_evento_ocultaciones;
CREATE POLICY "agenda_ocultaciones_update"
  ON agenda_evento_ocultaciones FOR UPDATE
  TO authenticated
  USING (alumno_id = (select auth.uid()))
  WITH CHECK (alumno_id = (select auth.uid()));

DROP POLICY IF EXISTS "agenda_ocultaciones_delete" ON agenda_evento_ocultaciones;
CREATE POLICY "agenda_ocultaciones_delete"
  ON agenda_evento_ocultaciones FOR DELETE
  TO authenticated
  USING (alumno_id = (select auth.uid()));
