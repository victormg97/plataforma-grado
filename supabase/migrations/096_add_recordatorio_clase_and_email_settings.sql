-- Migration 096: Add recordatorio_clase email type, email preferences, and cooldown settings
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add 'recordatorio_clase' value to tipo_notificacion enum
-- 2. Add 'enviar_correo_al_asignar' column to profiles (default true)
-- 3. Add 'recordatorio_cooldown_minutos' column to profiles (admin-only setting, default 60)
-- 4. Create email_recordatorios table to track reminder send counts per class+student
-- ─────────────────────────────────────────────────────────────────────────────

SET client_min_messages TO 'warning';

-- ── 1. Extend enum with 'recordatorio_clase' ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'recordatorio_clase'
      AND enumtypid = 'tipo_notificacion'::regtype
  ) THEN
    ALTER TYPE tipo_notificacion ADD VALUE 'recordatorio_clase';
  END IF;
END $$;

-- ── 2. Add email preference to profiles ──────────────────────────────────────
-- Controls whether automatic emails are sent when a class is assigned.
-- Only relevant for profesor/admin roles. Default TRUE (send emails).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enviar_correo_al_asignar boolean NOT NULL DEFAULT true;

-- ── 3. Add cooldown setting to profiles (admin-configurable) ─────────────────
-- Minimum minutes between reminder emails for the same class+student pair.
-- Only admins can change this; professors inherit the platform setting.
-- Default: 60 minutes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recordatorio_cooldown_minutos integer NOT NULL DEFAULT 60;

-- ── 4. Table email_recordatorios ─────────────────────────────────────────────
-- Tracks each reminder sent for a specific class (horario) + student (alumno).
-- Used for the counter display and cooldown enforcement.
CREATE TABLE IF NOT EXISTS public.email_recordatorios (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  horario_id      uuid        NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  alumno_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enviado_por     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_recordatorios_horario_alumno
  ON public.email_recordatorios(horario_id, alumno_id);

ALTER TABLE public.email_recordatorios ENABLE ROW LEVEL SECURITY;

-- RLS: profesor/admin can SELECT their own sent reminders or reminders for their classes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_recordatorios' AND policyname='profesor_admin: select email_recordatorios') THEN
    CREATE POLICY "profesor_admin: select email_recordatorios" ON public.email_recordatorios FOR SELECT TO authenticated
      USING (get_user_rol() IN ('profesor', 'admin'));
  END IF;
END $$;

-- INSERT done by server with admin client (bypass RLS), no INSERT policy needed.

SET client_min_messages TO 'notice';
