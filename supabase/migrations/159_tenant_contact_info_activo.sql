-- ============================================================
-- Migration 159: tenant_contact_info.activo
-- Lets an admin hide a contact entry (e.g. a lawyer's WhatsApp)
-- everywhere it is rendered (landing /contacto, "Quiénes somos" modal).
-- Hidden entries are not readable by the public; admins still see them.
-- ============================================================

ALTER TABLE public.tenant_contact_info
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "tenant_contact_info_select_public" ON public.tenant_contact_info;

CREATE POLICY "tenant_contact_info_select_public"
  ON public.tenant_contact_info FOR SELECT
  USING (
    activo = true
    OR (SELECT get_user_rol()) = 'admin'
  );
