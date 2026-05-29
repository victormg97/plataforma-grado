-- ============================================================
-- Migration 055: tenant_contact_info
-- Stores contact and social network entries per tenant.
-- ============================================================

CREATE TABLE public.tenant_contact_info (
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

-- updated_at trigger (follows project pattern)
CREATE OR REPLACE FUNCTION update_tenant_contact_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenant_contact_info_updated_at
  BEFORE UPDATE ON public.tenant_contact_info
  FOR EACH ROW EXECUTE FUNCTION update_tenant_contact_info_updated_at();

-- RLS
ALTER TABLE public.tenant_contact_info ENABLE ROW LEVEL SECURITY;

-- Public SELECT (anon + authenticated)
CREATE POLICY "tenant_contact_info_select_public"
  ON public.tenant_contact_info FOR SELECT
  USING (true);

-- Admin-only write (uses get_user_rol() to avoid RLS recursion)
CREATE POLICY "tenant_contact_info_write_admin"
  ON public.tenant_contact_info FOR ALL
  USING (
    (SELECT get_user_rol()) = 'admin'
  )
  WITH CHECK (
    (SELECT get_user_rol()) = 'admin'
  );
