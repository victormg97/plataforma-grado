-- Migration 048: Fix realtime, enums y notificaciones para nuevos tenants
-- ─────────────────────────────────────────────────────────────────────────────
-- Cubre todo lo que puede faltar en una BD de tenant nuevo respecto a:
--   1. Realtime publication + replica identity
--   2. Extensiones del enum tipo_notificacion
--   3. Extensiones del enum estado_asistencia
--   4. Columnas faltantes en notificaciones
--   5. Tabla solicitudes_cambio_horario + RLS
--   6. Políticas RLS faltantes en tablas existentes
--   7. Trigger de notificaciones (versión correcta)
--   8. Funciones RPC faltantes
-- COMPLETAMENTE IDEMPOTENTE — seguro de correr múltiples veces.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Realtime publication ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='horarios') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='asistencia') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asistencia;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notificaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='asignaciones_programa') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asignaciones_programa;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='programas_clases') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.programas_clases;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pruebas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pruebas;
  END IF;
END $$;

-- Replica identity full para que los filtros de columna funcionen en Realtime
ALTER TABLE public.horarios       REPLICA IDENTITY FULL;
ALTER TABLE public.asistencia     REPLICA IDENTITY FULL;
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;

-- ── 2. Extender enum tipo_notificacion ───────────────────────────────────────
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'nueva_clase';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'clase_modificada';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'clase_cancelada';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'programa_asignado';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'solicitud_cambio_horario';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'cambio_horario_aceptado';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'cambio_horario_rechazado';

-- ── 3. Extender enum estado_asistencia ───────────────────────────────────────
ALTER TYPE public.estado_asistencia ADD VALUE IF NOT EXISTS 'no_asistio';

-- ── 4. Columnas faltantes en notificaciones ──────────────────────────────────
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS programa_id  uuid REFERENCES public.programas_clases(id) ON DELETE SET NULL;

-- solicitud_id se agrega después de crear la tabla (ver sección 5)

-- ── 5. Tabla solicitudes_cambio_horario ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_cambio_horario (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumno_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profesor_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horario_original_id   uuid        NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  fecha_propuesta       date        NOT NULL,
  hora_inicio_propuesta time        NOT NULL,
  hora_fin_propuesta    time        NOT NULL,
  estado                text        NOT NULL DEFAULT 'pendiente'
                                    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  motivo_rechazo        text,
  nuevo_horario_id      uuid        REFERENCES public.horarios(id) ON DELETE SET NULL,
  nota_alumno           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cambio_alumno_id    ON public.solicitudes_cambio_horario(alumno_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cambio_profesor_id  ON public.solicitudes_cambio_horario(profesor_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cambio_estado       ON public.solicitudes_cambio_horario(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cambio_horario_orig ON public.solicitudes_cambio_horario(horario_original_id);

ALTER TABLE public.solicitudes_cambio_horario ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at para solicitudes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='solicitudes_cambio_horario_updated_at') THEN
    CREATE TRIGGER solicitudes_cambio_horario_updated_at
      BEFORE UPDATE ON public.solicitudes_cambio_horario
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- RLS policies para solicitudes_cambio_horario
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_cambio_horario' AND policyname='alumno: select own solicitudes_cambio') THEN
    CREATE POLICY "alumno: select own solicitudes_cambio" ON public.solicitudes_cambio_horario FOR SELECT TO authenticated
      USING (get_user_rol() = 'alumno' AND alumno_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_cambio_horario' AND policyname='alumno: insert own solicitud_cambio') THEN
    CREATE POLICY "alumno: insert own solicitud_cambio" ON public.solicitudes_cambio_horario FOR INSERT TO authenticated
      WITH CHECK (get_user_rol() = 'alumno' AND alumno_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_cambio_horario' AND policyname='profesor: select own solicitudes_cambio') THEN
    CREATE POLICY "profesor: select own solicitudes_cambio" ON public.solicitudes_cambio_horario FOR SELECT TO authenticated
      USING (get_user_rol() = 'profesor' AND profesor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_cambio_horario' AND policyname='profesor: update own solicitudes_cambio') THEN
    CREATE POLICY "profesor: update own solicitudes_cambio" ON public.solicitudes_cambio_horario FOR UPDATE TO authenticated
      USING (get_user_rol() = 'profesor' AND profesor_id = auth.uid())
      WITH CHECK (profesor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='solicitudes_cambio_horario' AND policyname='admin: select all solicitudes_cambio') THEN
    CREATE POLICY "admin: select all solicitudes_cambio" ON public.solicitudes_cambio_horario FOR SELECT TO authenticated
      USING (get_user_rol() = 'admin');
  END IF;
END $$;

-- Ahora sí agregar solicitud_id a notificaciones (la tabla ya existe)
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS solicitud_id uuid REFERENCES public.solicitudes_cambio_horario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_solicitud_id ON public.notificaciones(solicitud_id);

-- ── 6. Políticas RLS faltantes ───────────────────────────────────────────────

-- notificaciones: INSERT para usuarios autenticados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notificaciones' AND policyname='Autenticado puede insertar notificaciones') THEN
    CREATE POLICY "Autenticado puede insertar notificaciones" ON public.notificaciones FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- alumnos_extra: alumno puede insertar su propia ficha
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='alumnos_extra' AND policyname='Alumno inserta su propia ficha') THEN
    CREATE POLICY "Alumno inserta su propia ficha" ON public.alumnos_extra FOR INSERT
      WITH CHECK (alumno_id = auth.uid());
  END IF;
END $$;

-- ── 7. Trigger de notificaciones en asistencia (versión correcta) ────────────
-- Esta versión no notifica cuando el profesor/admin cambia el estado,
-- solo cuando el alumno lo hace.
CREATE OR REPLACE FUNCTION public.create_notification_on_asistencia_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profesor_id  uuid;
  v_titulo       text;
  v_nombre       text;
  v_tipo         tipo_notificacion;
  v_mensaje      text;
  v_current_user uuid;
BEGIN
  IF new.estado = old.estado THEN RETURN new; END IF;
  IF new.estado::text NOT IN ('confirmado', 'cancelado', 'cambiado') THEN RETURN new; END IF;

  SELECT profesor_id, titulo INTO v_profesor_id, v_titulo
    FROM public.horarios WHERE id = new.horario_id;

  IF v_profesor_id IS NULL THEN RETURN new; END IF;

  v_current_user := auth.uid();
  -- Solo notificar cuando el alumno hace el cambio
  IF v_current_user IS NOT NULL AND v_current_user != new.alumno_id THEN RETURN new; END IF;

  SELECT nombre || ' ' || apellido INTO v_nombre FROM public.profiles WHERE id = new.alumno_id;
  v_nombre := COALESCE(v_nombre, 'Un alumno');
  v_titulo := COALESCE(v_titulo, 'clase');

  CASE new.estado::text
    WHEN 'confirmado' THEN
      v_tipo    := 'confirmacion';
      v_mensaje := v_nombre || ' confirmó su asistencia a "' || v_titulo || '"';
    WHEN 'cancelado' THEN
      v_tipo    := 'cancelacion';
      v_mensaje := v_nombre || ' canceló su asistencia a "' || v_titulo || '"';
    WHEN 'cambiado' THEN
      v_tipo    := 'cambio_horario';
      v_mensaje := v_nombre || ' solicitó cambio de horario para "' || v_titulo || '"';
  END CASE;

  INSERT INTO public.notificaciones (destinatario_id, tipo, mensaje, horario_id, alumno_id, leida)
  VALUES (v_profesor_id, v_tipo, v_mensaje, new.horario_id, new.alumno_id, false);

  RETURN new;
END;
$$;

SET client_min_messages TO 'warning';
DROP TRIGGER IF EXISTS asistencia_on_estado_change ON public.asistencia;
SET client_min_messages TO 'notice';

CREATE TRIGGER asistencia_on_estado_change
  AFTER UPDATE ON public.asistencia
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_on_asistencia_change();

-- ── 8. Función delete_programa_asignado_notifications ────────────────────────
CREATE OR REPLACE FUNCTION public.delete_programa_asignado_notifications(
  p_programa_id uuid,
  p_alumno_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    get_user_rol() = 'admin'
    OR EXISTS (SELECT 1 FROM programas_clases WHERE id = p_programa_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM programa_profesores WHERE programa_id = p_programa_id AND profesor_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No autorizado para eliminar notificaciones de este programa';
  END IF;

  DELETE FROM notificaciones
  WHERE tipo = 'programa_asignado'
    AND programa_id = p_programa_id
    AND destinatario_id = ANY(p_alumno_ids);
END;
$$;

-- ── 9. Asegurar que horarios tiene from_programa ─────────────────────────────
ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS from_programa BOOLEAN DEFAULT false;
