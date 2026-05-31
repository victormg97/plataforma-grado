-- Migration 066: Enlaces de invitación autogestionados
-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla para enlaces dinámicos de invitación de registro (profesores/alumnos).
-- El invitado abre el enlace, se registra y queda autenticado; el enlace se
-- consume (estado 'usado') de forma atómica. Admin gestiona todos; profesor
-- habilitado solo los suyos de tipo alumno.
-- COMPLETAMENTE IDEMPOTENTE — seguro de correr múltiples veces.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enlaces_invitacion (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant            text        NOT NULL,
  codigo            text        NOT NULL UNIQUE,
  tipo              text        NOT NULL,
  estado            text        NOT NULL DEFAULT 'activo',
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  profesor_asignado uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_creado    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  eliminado         boolean     NOT NULL DEFAULT false,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- CHECK de tipo idempotente
ALTER TABLE public.enlaces_invitacion DROP CONSTRAINT IF EXISTS enlaces_invitacion_tipo_check;
ALTER TABLE public.enlaces_invitacion ADD  CONSTRAINT enlaces_invitacion_tipo_check CHECK (tipo IN ('profesor','alumno'));

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS enlaces_invitacion_codigo_key     ON public.enlaces_invitacion(codigo);
CREATE INDEX        IF NOT EXISTS enlaces_invitacion_created_by_idx ON public.enlaces_invitacion(created_by);
CREATE INDEX        IF NOT EXISTS enlaces_invitacion_estado_idx     ON public.enlaces_invitacion(estado);
CREATE INDEX        IF NOT EXISTS enlaces_invitacion_profesor_idx   ON public.enlaces_invitacion(profesor_asignado);
CREATE INDEX        IF NOT EXISTS enlaces_invitacion_usuario_idx    ON public.enlaces_invitacion(usuario_creado);

-- RLS
ALTER TABLE public.enlaces_invitacion ENABLE ROW LEVEL SECURITY;

-- SELECT: admin ve todo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enlaces_invitacion' AND policyname='admin lee enlaces') THEN
    CREATE POLICY "admin lee enlaces" ON public.enlaces_invitacion FOR SELECT
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- SELECT: profesor ve solo los suyos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enlaces_invitacion' AND policyname='profesor lee sus enlaces') THEN
    CREATE POLICY "profesor lee sus enlaces" ON public.enlaces_invitacion FOR SELECT
      USING (created_by = auth.uid());
  END IF;
END $$;

-- INSERT: admin cualquiera; profesor habilitado solo alumno propio
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enlaces_invitacion' AND policyname='crear enlaces') THEN
    CREATE POLICY "crear enlaces" ON public.enlaces_invitacion FOR INSERT
      WITH CHECK (
        created_by = auth.uid() AND (
          (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
          OR (
            (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor'
            AND (SELECT puede_crear_alumno FROM public.profiles WHERE id = auth.uid()) = true
            AND tipo = 'alumno'
          )
        )
      );
  END IF;
END $$;

-- UPDATE: solo admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enlaces_invitacion' AND policyname='admin actualiza enlaces') THEN
    CREATE POLICY "admin actualiza enlaces" ON public.enlaces_invitacion FOR UPDATE
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- DELETE: solo admin (por completitud; la app usa soft-delete vía UPDATE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enlaces_invitacion' AND policyname='admin elimina enlaces') THEN
    CREATE POLICY "admin elimina enlaces" ON public.enlaces_invitacion FOR DELETE
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;
