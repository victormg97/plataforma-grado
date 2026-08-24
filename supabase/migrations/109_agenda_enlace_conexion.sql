-- ============================================================
-- Migración 109: SLICE conexion — Enlace_Conexion en las Clases
-- ============================================================
-- Slice `conexion` -> columna nullable horarios.enlace_conexion
--
-- Requisitos: 1.7, 2.11, 11.1, 11.5, 16.1, 17.12
--
-- COMPLETAMENTE IDEMPOTENTE — segura de correr múltiples veces.
-- Sin literales de tenant: aplicable tal cual a cualquier despliegue
-- (Requisito 16.1).
-- Este es el ÚNICO cambio de esta funcionalidad sobre `horarios`: añade
-- una sola columna nullable y no añade, elimina ni renombra ninguna otra
-- (Requisitos 1.7, 2.11).
-- La guarda de dependencias es la primera sentencia y aborta la
-- transacción antes de modificar nada, de modo que un despliegue
-- incompleto no queda a medias (Requisito 16.2).
-- ============================================================

-- ── Guarda de dependencias (Requisito 16.2) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'horarios') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.horarios';
  END IF;
END $$;

-- ============================================================
-- SLICE conexion
-- ============================================================

-- ── Columna del Enlace_Conexion (Requisito 11.1) ────────────
-- Nullable y sin valor por defecto: las Clases existentes quedan con el
-- Enlace_Conexion vacío y conservan su comportamiento previo
-- (Requisitos 11.3, 11.12).
ALTER TABLE horarios
  ADD COLUMN IF NOT EXISTS enlace_conexion TEXT;

-- ── Límite de 2.000 caracteres (Requisito 11.5) ─────────────
-- La restricción se declara con guarda sobre `pg_constraint` en lugar de
-- capturar la excepción porque, según el tipo de restricción, un nombre
-- duplicado puede levantar `duplicate_table` y no `duplicate_object`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.horarios'::regclass
                   AND conname  = 'horarios_enlace_conexion_len') THEN
    ALTER TABLE horarios
      ADD CONSTRAINT horarios_enlace_conexion_len
      CHECK (enlace_conexion IS NULL OR char_length(enlace_conexion) <= 2000);
  END IF;
END $$;

COMMENT ON COLUMN horarios.enlace_conexion IS
  'Enlace_Conexion opcional de la Clase (Zoom, Meet u otro proveedor). Requisito 11.1.';
