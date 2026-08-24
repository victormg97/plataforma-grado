-- ============================================================
-- Migración 112: tipo de notificación de la agenda
-- ============================================================
-- Slice `notificaciones` -> valor `nueva_actividad` del enum
--                           `tipo_notificacion` + referencia de
--                           `notificaciones` al Evento_Agenda
--
-- Requisitos: 13.1, 13.2, 16.1, 17.12
--
-- COMPLETAMENTE IDEMPOTENTE Y CONVERGENTE — segura de correr
-- múltiples veces. El valor del enum se añade con
-- `ADD VALUE IF NOT EXISTS`; la columna, con
-- `ADD COLUMN IF NOT EXISTS`; el índice, con
-- `CREATE INDEX IF NOT EXISTS`. Los objetos que no admiten
-- `IF NOT EXISTS` se comprueban consultando el catálogo
-- (`pg_constraint`) en lugar de capturar excepciones
-- (Requisito 1.8).
-- Sin literales de tenant: aplicable tal cual a cualquier
-- despliegue (Requisito 16.1).
--
-- ── Nota sobre `ALTER TYPE ... ADD VALUE` ───────────────────
-- PostgreSQL prohíbe *usar* un valor de enum recién añadido
-- dentro de la misma transacción que lo añadió. Esta migración
-- respeta esa restricción sin partirse en dos archivos: el
-- `ADD VALUE` es una sentencia de nivel superior y **ninguna
-- sentencia posterior de este archivo referencia el literal
-- `'nueva_actividad'`** (la columna y el índice son de tipo
-- UUID y no dependen del enum). Por eso el archivo es seguro
-- tanto si el ejecutor lo envuelve en una única transacción
-- como si ejecuta sentencia por sentencia.
-- El `ADD VALUE` se deja **fuera** de cualquier bloque `DO`
-- a propósito: dentro de un bloque PL/pgSQL la sentencia corre
-- en una subtransacción implícita, algo que las versiones de
-- PostgreSQL anteriores a la 12 rechazan. Se sigue así el mismo
-- patrón que las migraciones 048, 054, 078 y 088 de este
-- proyecto.
-- ============================================================

-- ── Guarda de dependencias (Requisito 16.2) ─────────────────
-- Primera sentencia del archivo: aborta antes de tocar nada si
-- falta el enum `tipo_notificacion`, la tabla `notificaciones`
-- o la tabla `agenda_eventos` de la migración 108, de modo que
-- un despliegue incompleto no quede con una columna que apunta
-- a una tabla inexistente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public'
                   AND t.typname = 'tipo_notificacion') THEN
    RAISE EXCEPTION 'Dependencia ausente: enum public.tipo_notificacion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'notificaciones') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.notificaciones';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'agenda_eventos') THEN
    RAISE EXCEPTION 'Dependencia ausente: tabla public.agenda_eventos (aplica 108 primero)';
  END IF;
END $$;

-- ============================================================
-- 1. Valor `nueva_actividad` del enum (Requisito 13.1)
-- ============================================================
-- Tipo de la notificación y del correo que reciben los
-- Destinatarios_Vigentes cuando un Usuario_Editor crea una
-- Actividad o edita uno de sus Campos_Notificables.
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'nueva_actividad';

-- ============================================================
-- 2. Referencia al Evento_Agenda (Requisito 13.2)
-- ============================================================
-- `notificaciones` ya tiene una columna de referencia opcional
-- por tipo (`horario_id`, `programa_id`, `solicitud_id`,
-- `nota_clase_id`); `agenda_evento_id` sigue ese patrón en
-- nulabilidad: es NULL en toda notificación que no proceda de
-- una Actividad, así que no puede declararse NOT NULL.
--
-- Se aparta del patrón en la acción de borrado a propósito: las
-- columnas hermanas usan `ON DELETE SET NULL`, mientras que
-- esta usa `ON DELETE CASCADE`. Una notificación de tipo
-- `nueva_actividad` cuya Actividad ya no existe no tiene
-- destino al que enlazar, así que se elimina con ella. El
-- Requisito 13.17 solo exige conservar los `Registros_Envio`,
-- que no referencian la Actividad por clave foránea y por eso
-- sobreviven al borrado.
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS agenda_evento_id UUID;

-- La clave foránea se añade aparte porque `ADD CONSTRAINT` no
-- admite `IF NOT EXISTS`: se consulta `pg_constraint` para que
-- una segunda ejecución no falle y para reponerla si la columna
-- ya existía sin ella.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'notificaciones_agenda_evento_id_fkey'
                   AND conrelid = 'public.notificaciones'::regclass) THEN
    ALTER TABLE public.notificaciones
      ADD CONSTRAINT notificaciones_agenda_evento_id_fkey
      FOREIGN KEY (agenda_evento_id)
      REFERENCES public.agenda_eventos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índice parcial: solo las notificaciones de agenda tienen
-- valor en esta columna, de modo que el índice excluye a todas
-- las demás y se mantiene pequeño.
CREATE INDEX IF NOT EXISTS idx_notificaciones_agenda_evento
  ON public.notificaciones (agenda_evento_id)
  WHERE agenda_evento_id IS NOT NULL;
