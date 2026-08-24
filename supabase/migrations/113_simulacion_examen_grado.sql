-- ============================================================
-- Migración 113: Simulación de Examen de Grado
-- ============================================================
-- Agrega el tercer tipo de clase "Simulación" con comisión
-- multi-profesor y evaluaciones individuales.
--
-- Requisitos: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2
--
-- COMPLETAMENTE IDEMPOTENTE Y CONVERGENTE — segura de correr
-- múltiples veces. Usa `DO $$ ... EXCEPTION ... $$` para la
-- creación del enum, `ADD COLUMN IF NOT EXISTS` para la columna,
-- `CREATE TABLE IF NOT EXISTS` para las tablas, `CREATE INDEX
-- IF NOT EXISTS` para los índices, y `DROP POLICY IF EXISTS` +
-- `CREATE POLICY` para convergencia de RLS.
-- Sin literales de tenant: aplicable tal cual a cualquier
-- despliegue.
-- ============================================================

-- ── Guarda de dependencias ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'horarios') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.horarios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.profiles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'pruebas') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.pruebas';
  END IF;
END $$;

-- ============================================================
-- 1. Crear enum tipo_clase_enum (idempotente)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE tipo_clase_enum AS ENUM ('normal', 'interrogacion', 'simulacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. Agregar columna tipo_clase a horarios
-- ============================================================
ALTER TABLE horarios
  ADD COLUMN IF NOT EXISTS tipo_clase tipo_clase_enum NOT NULL DEFAULT 'normal';

-- ============================================================
-- 3. Migrar datos existentes: horarios con prueba → interrogacion
-- ============================================================
-- Idempotente: solo actualiza filas que aún están en 'normal'
-- y tienen una prueba vinculada.
UPDATE horarios
SET tipo_clase = 'interrogacion'
WHERE tipo_clase = 'normal'
  AND id IN (SELECT DISTINCT horario_id FROM pruebas WHERE horario_id IS NOT NULL);

-- ============================================================
-- 4. Tabla simulacion_comision
-- ============================================================
CREATE TABLE IF NOT EXISTS simulacion_comision (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id  UUID NOT NULL REFERENCES horarios(id) ON DELETE CASCADE,
  profesor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(horario_id, profesor_id)
);

-- Garantizar constraint UNIQUE si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.simulacion_comision'::regclass
                   AND conname  = 'simulacion_comision_horario_id_profesor_id_key') THEN
    ALTER TABLE simulacion_comision
      ADD CONSTRAINT simulacion_comision_horario_id_profesor_id_key
      UNIQUE (horario_id, profesor_id);
  END IF;
END $$;

-- ============================================================
-- 5. Tabla simulacion_evaluaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS simulacion_evaluaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id  UUID NOT NULL REFERENCES horarios(id) ON DELETE CASCADE,
  profesor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nota        NUMERIC(4,2) DEFAULT NULL,
  feedback    TEXT DEFAULT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'calificada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(horario_id, profesor_id)
);

-- Garantizar constraint UNIQUE si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.simulacion_evaluaciones'::regclass
                   AND conname  = 'simulacion_evaluaciones_horario_id_profesor_id_key') THEN
    ALTER TABLE simulacion_evaluaciones
      ADD CONSTRAINT simulacion_evaluaciones_horario_id_profesor_id_key
      UNIQUE (horario_id, profesor_id);
  END IF;
END $$;

-- Garantizar constraint CHECK si la tabla ya existía sin ella
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.simulacion_evaluaciones'::regclass
                   AND conname  = 'simulacion_evaluaciones_estado_check') THEN
    ALTER TABLE simulacion_evaluaciones
      ADD CONSTRAINT simulacion_evaluaciones_estado_check
      CHECK (estado IN ('pendiente', 'calificada'));
  END IF;
END $$;

-- ============================================================
-- 6. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_simulacion_comision_horario
  ON simulacion_comision(horario_id);

CREATE INDEX IF NOT EXISTS idx_simulacion_evaluaciones_horario
  ON simulacion_evaluaciones(horario_id);

CREATE INDEX IF NOT EXISTS idx_simulacion_evaluaciones_profesor
  ON simulacion_evaluaciones(profesor_id);

-- ============================================================
-- 7. RLS — simulacion_comision
-- ============================================================
ALTER TABLE simulacion_comision ENABLE ROW LEVEL SECURITY;

-- SELECT: visible si eres parte de la comisión, el profesor
-- responsable del horario, el alumno del horario, o admin.
DROP POLICY IF EXISTS "simulacion_comision_select" ON simulacion_comision;
CREATE POLICY "simulacion_comision_select"
  ON simulacion_comision FOR SELECT
  TO authenticated
  USING (
    -- Miembro de la comisión del mismo horario
    EXISTS (
      SELECT 1 FROM simulacion_comision sc2
      WHERE sc2.horario_id = simulacion_comision.horario_id
        AND sc2.profesor_id = (select auth.uid())
    )
    -- Profesor responsable del horario
    OR EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = simulacion_comision.horario_id
        AND h.profesor_id = (select auth.uid())
    )
    -- Alumno del horario
    OR EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = simulacion_comision.horario_id
        AND h.alumno_id = (select auth.uid())
    )
    -- Admin
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
        AND p.rol = 'admin'
    )
  );

-- INSERT: solo el profesor responsable del horario o un admin
DROP POLICY IF EXISTS "simulacion_comision_insert" ON simulacion_comision;
CREATE POLICY "simulacion_comision_insert"
  ON simulacion_comision FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = horario_id
        AND h.profesor_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
        AND p.rol = 'admin'
    )
  );

-- DELETE: solo el profesor responsable del horario o un admin
DROP POLICY IF EXISTS "simulacion_comision_delete" ON simulacion_comision;
CREATE POLICY "simulacion_comision_delete"
  ON simulacion_comision FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = simulacion_comision.horario_id
        AND h.profesor_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
        AND p.rol = 'admin'
    )
  );

-- ============================================================
-- 8. RLS — simulacion_evaluaciones
-- ============================================================
ALTER TABLE simulacion_evaluaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: el profesor owner, el alumno del horario, o un admin
DROP POLICY IF EXISTS "simulacion_evaluaciones_select" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_select"
  ON simulacion_evaluaciones FOR SELECT
  TO authenticated
  USING (
    profesor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = simulacion_evaluaciones.horario_id
        AND h.alumno_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
        AND p.rol = 'admin'
    )
  );

-- UPDATE: solo el profesor owner de esa evaluación
DROP POLICY IF EXISTS "simulacion_evaluaciones_update" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_update"
  ON simulacion_evaluaciones FOR UPDATE
  TO authenticated
  USING (profesor_id = (select auth.uid()))
  WITH CHECK (profesor_id = (select auth.uid()));

-- INSERT: solo el profesor responsable del horario o admin
-- (usado al crear la simulación desde el server action)
DROP POLICY IF EXISTS "simulacion_evaluaciones_insert" ON simulacion_evaluaciones;
CREATE POLICY "simulacion_evaluaciones_insert"
  ON simulacion_evaluaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM horarios h
      WHERE h.id = horario_id
        AND h.profesor_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
        AND p.rol = 'admin'
    )
  );

-- ============================================================
-- 9. Realtime
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'simulacion_comision'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.simulacion_comision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'simulacion_evaluaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.simulacion_evaluaciones;
  END IF;
END $$;
