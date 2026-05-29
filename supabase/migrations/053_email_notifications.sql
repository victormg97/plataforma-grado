-- Migration 053: Notificaciones por correo con Resend
-- ─────────────────────────────────────────────────────────────────────────────
-- Crea las tablas de soporte para el envío de correo transaccional:
--   1. email_plantillas  → plantillas personalizadas por usuario y tipo
--   2. email_envios      → registro de seguimiento de cada intento de envío
-- Incluye RLS, índices y triggers. COMPLETAMENTE IDEMPOTENTE — seguro de
-- correr múltiples veces.
--
-- Notas:
--   - El enum tipo_notificacion ya contiene los 4 tipos relevantes
--     (confirmacion, cancelacion, solicitud_cambio_horario, programa_asignado);
--     esta migración NO lo altera.
--   - La función update_updated_at() y get_user_rol() ya existen en la BD.
--   - El INSERT en email_envios lo realiza el servidor con createAdminClient()
--     (bypass RLS); por eso no se define política de INSERT.
-- ─────────────────────────────────────────────────────────────────────────────

SET client_min_messages TO 'warning';

-- ── 1. Tabla email_plantillas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_plantillas (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        tipo_notificacion NOT NULL,
  asunto      text        NOT NULL CHECK (char_length(asunto) BETWEEN 1 AND 200),
  cuerpo_html text        NOT NULL CHECK (char_length(btrim(cuerpo_html)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_email_plantillas_user ON public.email_plantillas(user_id);

ALTER TABLE public.email_plantillas ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at (la función update_updated_at() ya existe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'email_plantillas_updated_at') THEN
    CREATE TRIGGER email_plantillas_updated_at
      BEFORE UPDATE ON public.email_plantillas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- RLS email_plantillas: profesor/admin gestionan SOLO sus filas propias.
-- El alumno no tiene políticas → sin acceso (Requisito 6.5, 7.4, 15.8).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_plantillas' AND policyname='editor: select own email_plantillas') THEN
    CREATE POLICY "editor: select own email_plantillas" ON public.email_plantillas FOR SELECT TO authenticated
      USING (get_user_rol() IN ('profesor', 'admin') AND user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_plantillas' AND policyname='editor: insert own email_plantillas') THEN
    CREATE POLICY "editor: insert own email_plantillas" ON public.email_plantillas FOR INSERT TO authenticated
      WITH CHECK (get_user_rol() IN ('profesor', 'admin') AND user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_plantillas' AND policyname='editor: update own email_plantillas') THEN
    CREATE POLICY "editor: update own email_plantillas" ON public.email_plantillas FOR UPDATE TO authenticated
      USING (get_user_rol() IN ('profesor', 'admin') AND user_id = auth.uid())
      WITH CHECK (get_user_rol() IN ('profesor', 'admin') AND user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_plantillas' AND policyname='editor: delete own email_plantillas') THEN
    CREATE POLICY "editor: delete own email_plantillas" ON public.email_plantillas FOR DELETE TO authenticated
      USING (get_user_rol() IN ('profesor', 'admin') AND user_id = auth.uid());
  END IF;
END $$;

-- ── 2. Tabla email_envios ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_envios (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  originador_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destinatario_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo            tipo_notificacion NOT NULL,
  resultado       text        NOT NULL CHECK (resultado IN ('enviado','fallo','omitido_sin_clave','omitido_destinatario','omitido_rate_limit')),
  motivo          text,
  horario_id      uuid        REFERENCES public.horarios(id) ON DELETE SET NULL,
  evento_id       text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Restricción única parcial: no más de un envío exitoso por evento y destinatario
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_envios_evento_dest
  ON public.email_envios(evento_id, destinatario_id)
  WHERE resultado = 'enviado';

CREATE INDEX IF NOT EXISTS idx_email_envios_horario      ON public.email_envios(horario_id);
CREATE INDEX IF NOT EXISTS idx_email_envios_originador   ON public.email_envios(originador_id);
CREATE INDEX IF NOT EXISTS idx_email_envios_destinatario ON public.email_envios(destinatario_id);

ALTER TABLE public.email_envios ENABLE ROW LEVEL SECURITY;

-- RLS email_envios:
--   - admin: SELECT de todas las filas.
--   - cualquier autenticado: SELECT donde sea destinatario u originador.
--   El INSERT lo realiza el servidor con createAdminClient() (bypass RLS),
--   por lo que NO se define política de INSERT (Requisito 10.5).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_envios' AND policyname='admin: select all email_envios') THEN
    CREATE POLICY "admin: select all email_envios" ON public.email_envios FOR SELECT TO authenticated
      USING (get_user_rol() = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_envios' AND policyname='usuario: select propios email_envios') THEN
    CREATE POLICY "usuario: select propios email_envios" ON public.email_envios FOR SELECT TO authenticated
      USING (destinatario_id = auth.uid() OR originador_id = auth.uid());
  END IF;
END $$;

SET client_min_messages TO 'notice';
