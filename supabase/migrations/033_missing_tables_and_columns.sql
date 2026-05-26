-- Migration 033: Add missing tables and columns that were created directly in DB
-- without a corresponding migration file.
-- Safe to run on any tenant DB — uses IF NOT EXISTS guards.

-- ─────────────────────────────────────────────
-- 1. profiles — missing columns
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apellido_materno           TEXT,
  ADD COLUMN IF NOT EXISTS idioma                     TEXT,
  ADD COLUMN IF NOT EXISTS tema                       TEXT,
  ADD COLUMN IF NOT EXISTS duracion_clase_default_min INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS puede_crear_alumno         BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────
-- 2. alumnos_extra — missing columns
-- ─────────────────────────────────────────────
ALTER TABLE public.alumnos_extra
  ADD COLUMN IF NOT EXISTS intentos_prueba INTEGER,
  ADD COLUMN IF NOT EXISTS ha_dado_examen  BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 3. invitations — full table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT        NOT NULL UNIQUE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used            BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  temp_password   TEXT,
  invitation_type TEXT        DEFAULT 'link',
  email           TEXT
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Admins can manage invitations'
  ) THEN
    CREATE POLICY "Admins can manage invitations"
      ON public.invitations FOR ALL
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Anyone can read invitation by code'
  ) THEN
    CREATE POLICY "Anyone can read invitation by code"
      ON public.invitations FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Users can view their own invitations'
  ) THEN
    CREATE POLICY "Users can view their own invitations"
      ON public.invitations FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Users can update their invitations'
  ) THEN
    CREATE POLICY "Users can update their invitations"
      ON public.invitations FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 4. notas_alumno — full table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notas_alumno (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumno_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  autor_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contenido  TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notas_alumno ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notas_alumno'
      AND policyname = 'profesor_ve_sus_notas_alumno'
  ) THEN
    CREATE POLICY "profesor_ve_sus_notas_alumno"
      ON public.notas_alumno FOR SELECT
      USING (
        autor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND rol = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notas_alumno'
      AND policyname = 'profesor_crea_notas_alumno'
  ) THEN
    CREATE POLICY "profesor_crea_notas_alumno"
      ON public.notas_alumno FOR INSERT
      WITH CHECK (
        autor_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND rol IN ('profesor', 'admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notas_alumno'
      AND policyname = 'profesor_edita_sus_notas_alumno'
  ) THEN
    CREATE POLICY "profesor_edita_sus_notas_alumno"
      ON public.notas_alumno FOR UPDATE
      USING (autor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notas_alumno'
      AND policyname = 'profesor_elimina_sus_notas_alumno'
  ) THEN
    CREATE POLICY "profesor_elimina_sus_notas_alumno"
      ON public.notas_alumno FOR DELETE
      USING (
        autor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND rol = 'admin'
        )
      );
  END IF;
END $$;
