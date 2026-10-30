import type { TenantConfigInput } from '../schema';

const config: TenantConfigInput = {
  id: 'cta-graduados',
  nombre: 'CTA Graduados',
  descripcion: 'Preparación para el Examen de Grado',
  emailDomain: 'ctagraduados.cl',
  terminoPrueba: { singular: 'Prueba', plural: 'Pruebas' },
  logoLight: '/tenants/cta-graduados/logo-light.webp',
  logoDark: '/tenants/cta-graduados/logo-dark.webp',
  propietarios: [
    {
      nombre: 'Carlos Toro Araya',
      email: 'admin@cta-grados.cl',
    },
  ],
  theme: {
    colorAccent: '#C9993F',
    colorAccentLight: '#E8C97A',
    colorInput: '#FDFBF7',       // Crema muy suave (casi blanco con tinte cálido)
    colorPopover: '#FDFBF7',     // Dropdowns mismo tono
  },
  fonts: {
    display: 'Playfair Display',
    body: 'DM Sans',
  },
  metadata: {
    favicon: '/tenants/cta-graduados/favicon.ico',
    ogImage: '/tenants/cta-graduados/logo-light.webp',
  },
  seo: {
    siteUrl: 'https://www.ctagraduados.cl',
    appHost: 'app.ctagraduados.cl',
    keywords: [
      'examen de grado',
      'preparación examen de grado',
      'grado de derecho',
      'CTA Graduados',
    ],
    ogImageAlt: 'CTA Graduados — Preparación para el Examen de Grado',
  },
};

export default config;
