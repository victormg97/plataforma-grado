import type { TenantConfigInput } from '../schema';

const config: TenantConfigInput = {
  id: 'cta-graduados',
  nombre: 'CTA Graduados',
  descripcion: 'Preparación para el Examen de Grado',
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
  },
  fonts: {
    display: 'Playfair Display',
    body: 'DM Sans',
  },
};

export default config;
