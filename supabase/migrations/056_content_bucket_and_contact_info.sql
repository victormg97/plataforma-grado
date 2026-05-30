-- ============================================================
-- Migration 056: tenant_contact_info table + content bucket
-- Ejecutar en el SQL Editor del proyecto de producción.
-- ============================================================

-- ── 1. Tabla tenant_contact_info ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_contact_info (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  type        text NOT NULL CHECK (type IN ('whatsapp', 'email', 'social')),
  label       text NOT NULL,
  value       text NOT NULL,
  url         text NOT NULL,
  icon_key    text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_contact_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_contact_info_updated_at ON public.tenant_contact_info;
CREATE TRIGGER trg_tenant_contact_info_updated_at
  BEFORE UPDATE ON public.tenant_contact_info
  FOR EACH ROW EXECUTE FUNCTION update_tenant_contact_info_updated_at();

-- RLS
ALTER TABLE public.tenant_contact_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contact_info_select_public" ON public.tenant_contact_info;
CREATE POLICY "tenant_contact_info_select_public"
  ON public.tenant_contact_info FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "tenant_contact_info_write_admin" ON public.tenant_contact_info;
CREATE POLICY "tenant_contact_info_write_admin"
  ON public.tenant_contact_info FOR ALL
  USING ((SELECT get_user_rol()) = 'admin')
  WITH CHECK ((SELECT get_user_rol()) = 'admin');

-- ── 2. Seed data para pregunta-estrategica ───────────────────────────────────

INSERT INTO public.tenant_contact_info (tenant_slug, type, label, value, url, icon_key, sort_order)
VALUES
  ('pregunta-estrategica', 'whatsapp', 'Estefanía Montalbán', '+56933178853', 'https://wa.me/56933178853', NULL, 1),
  ('pregunta-estrategica', 'whatsapp', 'Camila Ogalde',       '+56951250444', 'https://wa.me/56951250444', NULL, 2),
  ('pregunta-estrategica', 'email',    'Correo',              'preguntaestrategica@gmail.com', 'mailto:preguntaestrategica@gmail.com', NULL, 3),
  ('pregunta-estrategica', 'social',   'Instagram',           '@preguntaestrategica', 'https://instagram.com/preguntaestrategica', 'instagram', 4)
ON CONFLICT DO NOTHING;

-- ── 3. Bucket content (público) ──────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content',
  'content',
  true,
  10485760,
  ARRAY[
    'text/markdown',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 4. Políticas de Storage para el bucket content ───────────────────────────

DROP POLICY IF EXISTS "content_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "content_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "content_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "content_auth_delete"   ON storage.objects;

-- Lectura pública (anon + authenticated)
CREATE POLICY "content_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content');

-- Escritura para usuarios autenticados
CREATE POLICY "content_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content');

CREATE POLICY "content_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'content')
  WITH CHECK (bucket_id = 'content');

CREATE POLICY "content_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'content');
