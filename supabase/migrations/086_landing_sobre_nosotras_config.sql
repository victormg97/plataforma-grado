-- Table for configurable "Sobre Nosotras" images and names
CREATE TABLE public.landing_sobre_nosotras_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,

  -- Person 1 (top image - Estefanía)
  persona1_nombre text NOT NULL DEFAULT 'Estefanía Montalbán Pino',
  persona1_prefijo text NOT NULL DEFAULT 'Abogada',
  persona1_image_path text, -- path in storage bucket (e.g. tenants/pregunta-estrategica/sobre-nosotras-1.webp)

  -- Person 2 (bottom image - Camila)
  persona2_nombre text NOT NULL DEFAULT 'Camila Ogalde Fonck',
  persona2_prefijo text NOT NULL DEFAULT 'Abogada',
  persona2_image_path text, -- path in storage bucket

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One config per tenant
  CONSTRAINT landing_sobre_nosotras_config_tenant_slug_unique UNIQUE (tenant_slug)
);

-- RLS
ALTER TABLE public.landing_sobre_nosotras_config ENABLE ROW LEVEL SECURITY;

-- Public read (landing is public)
CREATE POLICY "landing_sobre_nosotras_config_select_public"
  ON public.landing_sobre_nosotras_config
  FOR SELECT
  USING (true);

-- Only admins can write
CREATE POLICY "landing_sobre_nosotras_config_write_admin"
  ON public.landing_sobre_nosotras_config
  FOR ALL
  USING ((SELECT get_user_rol()) = 'admin'::user_rol);

-- Seed default config for pregunta-estrategica
INSERT INTO public.landing_sobre_nosotras_config (
  tenant_slug,
  persona1_nombre, persona1_prefijo, persona1_image_path,
  persona2_nombre, persona2_prefijo, persona2_image_path
) VALUES (
  'pregunta-estrategica',
  'Estefanía Montalbán Pino', 'Abogada', NULL,
  'Camila Ogalde Fonck', 'Abogada', NULL
);
