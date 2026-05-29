-- Migration 047: New tenant catch-all
-- ─────────────────────────────────────────────────────────────────────────────
-- Aplica todas las columnas, tablas y funciones que pueden faltar en una BD
-- de tenant nuevo creada con migraciones desincronizadas.
-- COMPLETAMENTE IDEMPOTENTE — seguro de correr múltiples veces.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles — columnas que se agregaron sin migración ────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apellido_materno           TEXT,
  ADD COLUMN IF NOT EXISTS idioma                     TEXT,
  ADD COLUMN IF NOT EXISTS tema                       TEXT,
  ADD COLUMN IF NOT EXISTS duracion_clase_default_min INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS puede_crear_alumno         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER NOT NULL DEFAULT 0;

-- Constraint idempotente para cancellation_deadline_hours
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cancellation_deadline_hours_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cancellation_deadline_hours_check
    CHECK (cancellation_deadline_hours >= 0);

-- ── 2. alumnos_extra — columnas que se agregaron sin migración ───────────────
ALTER TABLE public.alumnos_extra
  ADD COLUMN IF NOT EXISTS intentos_prueba INTEGER,
  ADD COLUMN IF NOT EXISTS ha_dado_examen  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_ingreso   DATE,
  ADD COLUMN IF NOT EXISTS año_egreso      TEXT;

-- ── 3. horarios — columna from_programa ─────────────────────────────────────
ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS from_programa BOOLEAN DEFAULT false;

-- ── 4. recursos_compartidos — columna bloquear_descarga ─────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recursos_compartidos'
  ) THEN
    ALTER TABLE public.recursos_compartidos
      ADD COLUMN IF NOT EXISTS bloquear_descarga BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 5. invitations — tabla completa ─────────────────────────────────────────
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Admins can manage invitations') THEN
    CREATE POLICY "Admins can manage invitations" ON public.invitations FOR ALL
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Anyone can read invitation by code') THEN
    CREATE POLICY "Anyone can read invitation by code" ON public.invitations FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Users can view their own invitations') THEN
    CREATE POLICY "Users can view their own invitations" ON public.invitations FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Users can update their invitations') THEN
    CREATE POLICY "Users can update their invitations" ON public.invitations FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ── 6. notas_alumno — tabla completa ────────────────────────────────────────
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notas_alumno' AND policyname='profesor_ve_sus_notas_alumno') THEN
    CREATE POLICY "profesor_ve_sus_notas_alumno" ON public.notas_alumno FOR SELECT
      USING (autor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notas_alumno' AND policyname='profesor_crea_notas_alumno') THEN
    CREATE POLICY "profesor_crea_notas_alumno" ON public.notas_alumno FOR INSERT
      WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol IN ('profesor', 'admin')));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notas_alumno' AND policyname='profesor_edita_sus_notas_alumno') THEN
    CREATE POLICY "profesor_edita_sus_notas_alumno" ON public.notas_alumno FOR UPDATE USING (autor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notas_alumno' AND policyname='profesor_elimina_sus_notas_alumno') THEN
    CREATE POLICY "profesor_elimina_sus_notas_alumno" ON public.notas_alumno FOR DELETE
      USING (autor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

-- ── 7. alumno_bloqueos — tabla completa ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alumno_bloqueos (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumno_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bloqueado_por UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  accion        TEXT        NOT NULL CHECK (accion IN ('bloqueado', 'desbloqueado')),
  motivo        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alumno_bloqueos_alumno_id_idx  ON public.alumno_bloqueos(alumno_id);
CREATE INDEX IF NOT EXISTS alumno_bloqueos_created_at_idx ON public.alumno_bloqueos(created_at DESC);

ALTER TABLE public.alumno_bloqueos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='alumno_bloqueos' AND policyname='Admin gestiona bloqueos') THEN
    CREATE POLICY "Admin gestiona bloqueos" ON public.alumno_bloqueos FOR ALL
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='alumno_bloqueos' AND policyname='Profesor ve bloqueos de sus alumnos') THEN
    CREATE POLICY "Profesor ve bloqueos de sus alumnos" ON public.alumno_bloqueos FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = alumno_bloqueos.alumno_id AND ae.profesor_id = auth.uid()));
  END IF;
END $$;

-- ── 8. Trigger handle_new_user — versión robusta ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_rol text;
  v_rol_final user_rol;
BEGIN
  v_rol := new.raw_user_meta_data->>'rol';
  
  IF v_rol = 'admin' THEN
    v_rol_final := 'admin'::user_rol;
  ELSIF v_rol = 'profesor' THEN
    v_rol_final := 'profesor'::user_rol;
  ELSE
    v_rol_final := 'alumno'::user_rol;
  END IF;

  INSERT INTO public.profiles (id, email, nombre, apellido, rol)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'apellido', ''),
    v_rol_final
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 9. Reparar perfiles faltantes (usuarios sin perfil por trigger fallido) ──
INSERT INTO public.profiles (id, email, nombre, apellido, rol)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nombre', 'Usuario'),
  COALESCE(au.raw_user_meta_data->>'apellido', ''),
  CASE
    WHEN au.raw_user_meta_data->>'rol' = 'admin'   THEN 'admin'::user_rol
    WHEN au.raw_user_meta_data->>'rol' = 'profesor' THEN 'profesor'::user_rol
    ELSE 'alumno'::user_rol
  END
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;
