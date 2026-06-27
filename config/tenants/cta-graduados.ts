import type { TenantConfigInput } from '../schema';

const config: TenantConfigInput = {
  id: 'cta-graduados',
  nombre: 'CTA Graduados',
  descripcion: 'Preparación para el Examen de Grado',
  emailDomain: 'ctagraduados.cl',
  terminoPrueba: { singular: 'Prueba', plural: 'Pruebas' },
  logoLight: '/tenants/cta-graduados/logo-light.png',
  logoDark: '/tenants/cta-graduados/logo-dark.png',
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
  },
};

export default config;
