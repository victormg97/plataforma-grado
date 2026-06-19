-- Table for configurable landing page pricing (planes section)
CREATE TABLE public.landing_planes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,

  -- Offer header
  oferta_activa boolean NOT NULL DEFAULT false,
  oferta_texto text, -- custom text e.g. "Oferta Especial"
  oferta_mes_automatico boolean NOT NULL DEFAULT true, -- auto-generates "Oferta {month}"

  -- Plan 1 (interrogaciones)
  plan1_nombre text NOT NULL DEFAULT 'PLAN 1',
  plan1_detalle text NOT NULL DEFAULT '4 interrogaciones mensuales',
  plan1_precio integer NOT NULL DEFAULT 45000,
  plan1_precio_antes integer, -- null = no strikethrough price
  
  -- Plan 2 (interrogaciones)
  plan2_nombre text NOT NULL DEFAULT 'PLAN 2',
  plan2_detalle text NOT NULL DEFAULT '8 interrogaciones mensuales',
  plan2_precio integer NOT NULL DEFAULT 80000,
  plan2_precio_antes integer,
  
  -- Tutoría 1
  tutoria1_nombre text NOT NULL DEFAULT 'SESIÓN 1 HORA',
  tutoria1_detalle text NOT NULL DEFAULT '1 persona',
  tutoria1_precio integer NOT NULL DEFAULT 10000,
  
  -- Tutoría 2
  tutoria2_nombre text NOT NULL DEFAULT 'SESIÓN 1 HORA',
  tutoria2_detalle text NOT NULL DEFAULT '2 personas',
  tutoria2_precio integer NOT NULL DEFAULT 15000,
  
  -- Programa Lector
  lector_precio integer NOT NULL DEFAULT 15000,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One config per tenant
  CONSTRAINT landing_planes_config_tenant_slug_unique UNIQUE (tenant_slug)
);

-- RLS
ALTER TABLE public.landing_planes_config ENABLE ROW LEVEL SECURITY;

-- Public read access (landing page is public, no auth required)
CREATE POLICY "landing_planes_config_select_public"
  ON public.landing_planes_config
  FOR SELECT
  USING (true);

-- Only admins can write (insert/update/delete)
CREATE POLICY "landing_planes_config_write_admin"
  ON public.landing_planes_config
  FOR ALL
  USING ((SELECT get_user_rol()) = 'admin'::user_rol);

-- Seed default config for pregunta-estrategica
INSERT INTO public.landing_planes_config (
  tenant_slug,
  oferta_activa, oferta_texto, oferta_mes_automatico,
  plan1_nombre, plan1_detalle, plan1_precio, plan1_precio_antes,
  plan2_nombre, plan2_detalle, plan2_precio, plan2_precio_antes,
  tutoria1_nombre, tutoria1_detalle, tutoria1_precio,
  tutoria2_nombre, tutoria2_detalle, tutoria2_precio,
  lector_precio
) VALUES (
  'pregunta-estrategica',
  true, NULL, true,
  'PLAN 1', '4 interrogaciones mensuales', 45000, 50000,
  'PLAN 2', '8 interrogaciones mensuales', 80000, 90000,
  'SESIÓN 1 HORA', '1 persona', 10000,
  'SESIÓN 1 HORA', '2 personas', 15000,
  15000
);
