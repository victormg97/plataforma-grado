import type { MetadataRoute } from 'next';
import { tenantConfig } from '@/config';

/**
 * Web App Manifest por tenant (PWA básica / metadata de instalación).
 * Los colores e íconos salen de la config del tenant activo.
 */
export default function manifest(): MetadataRoute.Manifest {
  const favicon =
    tenantConfig.metadata?.favicon || '/tenants/cta-graduados/favicon.ico';
  const themeColor = tenantConfig.theme.colorAccent;
  const backgroundColor = tenantConfig.theme.colorBg || '#ffffff';

  return {
    name: `${tenantConfig.nombre} — ${tenantConfig.descripcion}`,
    short_name: tenantConfig.nombre,
    description: tenantConfig.descripcion,
    start_url: '/',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: favicon,
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
