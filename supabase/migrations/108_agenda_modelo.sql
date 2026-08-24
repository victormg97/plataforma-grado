-- ============================================================
-- Migración 108: Modelo de datos de la agenda completa
-- ============================================================
-- Slice `nucleo`      -> enums + agenda_eventos + trigger + índices
-- Slice `actividades` -> agenda_evento_destinatarios
-- Slice `ocultacion`  -> agenda_evento_ocultaciones
--
-- Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.11, 1.12, 1.13,
--             4.10, 10.1, 10.11, 12.11, 16.1, 16.2, 17.12
--
-- COMPLETAMENTE IDEMPOTENTE — segura de correr múltiples veces.
-- Sin literales de tenant: aplicable tal cual a cualquier despliegue
-- (Requisito 16.1).
-- La guarda de dependencias es la primera sentencia y aborta la
-- transacción de la migración antes de crear nada, de modo que un
-- despliegue incompleto no queda con objetos parciales (Requisito 16.2).
-- ============================================================

-- ── Guarda de dependencias (Requisito 16.2) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.profiles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'alumnos_extra') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.alumnos_extra';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'horarios') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.horarios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public'
                   AND p.proname = 'update_updated_at_column') THEN
    RAISE EXCEPTION 'Dependencia ausente: función public.update_updated_at_column()';
  END IF;
END $$;

-- ============================================================
-- SLICE nucleo
-- ============================================================

-- ── Enums del dominio (Requisitos 1.4, 1.5, 10.1) ───────────
DO $$ BEGIN
  CREATE TYPE agenda_alcance AS ENUM ('personal', 'alumnos_seleccionados', 'todos_alumnos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agenda_visibilidad AS ENUM ('privada', 'publica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Conjunto cerrado de ocho valores (Requisito 10.1)
DO $$ BEGIN
  CREATE TYPE agenda_categoria AS ENUM (
    'clase', 'reunion', 'estudio', 'personal',
    'administrativo', 'evento_externo', 'plazo', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabla de Eventos_Agenda (Requisitos 1.1, 1.11, 1.13) ────
-- `creador_id` con ON DELETE CASCADE: al eliminarse el perfil del Autor
-- sus eventos desaparecen y la consulta de agenda responde sin error
-- en lugar de dejar filas huérfanas (Requisito 4.10).
-- Un Evento_Agenda cabe en una sola fecha: no hay recurrencia ni fecha
-- de fin (Requisito 10.11).
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,                                   -- sin límite (Req 10.15)
  nota            TEXT,                                   -- sin límite (Req 10.15)
  categoria       agenda_categoria   NOT NULL DEFAULT 'otro',
  alcance         agenda_alcance     NOT NULL,
  visibilidad     agenda_visibilidad NOT NULL DEFAULT 'privada',
  fecha           DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  dia_completo    BOOLEAN NOT NULL DEFAULT false,
  lugar           TEXT,
  enlace_conexion TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Requisito 1.1 / 3.5: título de 1 a 120 caracteres tras recortar espacios
  CONSTRAINT agenda_eventos_titulo_len
    CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 120),
  -- Requisito 1.1 / 10.12
  CONSTRAINT agenda_eventos_lugar_len
    CHECK (lugar IS NULL OR char_length(lugar) <= 200),
  CONSTRAINT agenda_eventos_enlace_len
    CHECK (enlace_conexion IS NULL OR char_length(enlace_conexion) <= 2000),
  -- Requisito 1.6: hora_fin > hora_inicio; admite 00:00–23:59
  CONSTRAINT agenda_eventos_rango_valido
    CHECK (hora_fin > hora_inicio)
);

-- Las cuatro restricciones se declaran por nombre también fuera del
-- CREATE TABLE para que la migración converja en una base donde la tabla ya
-- existía sin ellas (Requisito 1.8: segunda ejecución sin error y mismo
-- conjunto de objetos). La guarda consulta `pg_constraint` en lugar de
-- capturar la excepción porque una restricción duplicada que respalda un
-- índice levanta `duplicate_table`, no `duplicate_object`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_eventos'::regclass
                   AND conname  = 'agenda_eventos_titulo_len') THEN
    ALTER TABLE agenda_eventos
      ADD CONSTRAINT agenda_eventos_titulo_len
      CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 120);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_eventos'::regclass
                   AND conname  = 'agenda_eventos_lugar_len') THEN
    ALTER TABLE agenda_eventos
      ADD CONSTRAINT agenda_eventos_lugar_len
      CHECK (lugar IS NULL OR char_length(lugar) <= 200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_eventos'::regclass
                   AND conname  = 'agenda_eventos_enlace_len') THEN
    ALTER TABLE agenda_eventos
      ADD CONSTRAINT agenda_eventos_enlace_len
      CHECK (enlace_conexion IS NULL OR char_length(enlace_conexion) <= 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_eventos'::regclass
                   AND conname  = 'agenda_eventos_rango_valido') THEN
    ALTER TABLE agenda_eventos
      ADD CONSTRAINT agenda_eventos_rango_valido
      CHECK (hora_fin > hora_inicio);
  END IF;
END $$;

-- Requisito 1.12: updated_at se refresca, created_at se conserva
DROP TRIGGER IF EXISTS agenda_eventos_updated_at ON agenda_eventos;
CREATE TRIGGER agenda_eventos_updated_at
  BEFORE UPDATE ON agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Índices de agenda_eventos (Requisito 12.11) ─────────────
-- Consulta por Rango_Visible
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_fecha
  ON agenda_eventos (fecha) WHERE activo;
-- Consulta por Autor dentro del Rango_Visible
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_creador_fecha
  ON agenda_eventos (creador_id, fecha) WHERE activo;
-- Filtra la Audiencia_Dinamica sin escanear entradas personales
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_alcance_fecha
  ON agenda_eventos (alcance, fecha) WHERE activo AND alcance <> 'personal';
-- Lectura de entradas públicas ajenas (matriz del Requisito 8)
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_publicas
  ON agenda_eventos (fecha, creador_id)
  WHERE activo AND alcance = 'personal' AND visibilidad = 'publica';

-- ============================================================
-- SLICE actividades
-- ============================================================

-- ── Destinatario_Explicito (Requisitos 1.2, 1.13) ───────────
CREATE TABLE IF NOT EXISTS agenda_evento_destinatarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  UUID NOT NULL REFERENCES agenda_eventos(id) ON DELETE CASCADE,
  alumno_id  UUID NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agenda_evento_destinatarios_unico UNIQUE (evento_id, alumno_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_evento_destinatarios'::regclass
                   AND conname  = 'agenda_evento_destinatarios_unico') THEN
    ALTER TABLE agenda_evento_destinatarios
      ADD CONSTRAINT agenda_evento_destinatarios_unico UNIQUE (evento_id, alumno_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_destinatarios_alumno
  ON agenda_evento_destinatarios (alumno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_destinatarios_evento
  ON agenda_evento_destinatarios (evento_id);

-- ============================================================
-- SLICE ocultacion
-- ============================================================

-- ── Ocultacion_Alumno (Requisitos 1.3, 1.13) ────────────────
CREATE TABLE IF NOT EXISTS agenda_evento_ocultaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  UUID NOT NULL REFERENCES agenda_eventos(id) ON DELETE CASCADE,
  alumno_id  UUID NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agenda_evento_ocultaciones_unico UNIQUE (evento_id, alumno_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.agenda_evento_ocultaciones'::regclass
                   AND conname  = 'agenda_evento_ocultaciones_unico') THEN
    ALTER TABLE agenda_evento_ocultaciones
      ADD CONSTRAINT agenda_evento_ocultaciones_unico UNIQUE (evento_id, alumno_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_ocultaciones_alumno
  ON agenda_evento_ocultaciones (alumno_id);

-- ============================================================
-- Realtime (Requisito 12.6)
-- ============================================================
-- Mismo patrón que las migraciones 002, 048 y 065: la pertenencia a la
-- publicación se comprueba antes de añadir la tabla, de modo que una
-- segunda ejecución no falla. Se conserva la REPLICA IDENTITY por defecto
-- (clave primaria): el hook de agenda solo invalida la caché por prefijo y
-- no necesita el payload completo de la fila.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_eventos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_eventos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_evento_destinatarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_evento_destinatarios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_evento_ocultaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_evento_ocultaciones;
  END IF;
END $$;
