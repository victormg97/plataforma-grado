import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getSiteUrl, getAppHost } from '@/config/seo';

/**
 * robots.txt dinámico por host.
 *
 * El mismo deploy responde tanto en el landing (www) como en la plataforma
 * (app.). Queremos que Google indexe SOLO el landing y mantenga la plataforma
 * (todo detrás de login) fuera del índice:
 *   - Host `app.` → Disallow: / (nada indexable).
 *   - Host `www`/otro → permitir todo salvo rutas privadas, y apuntar al sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const hdrs = await headers();
  const host = (hdrs.get('host') || '').toLowerCase();
  const appHost = getAppHost();
  const siteUrl = getSiteUrl();

  const isAppHost = Boolean(appHost) && host === appHost;

  if (isAppHost) {
    // Subdominio de la plataforma: no indexar nada.
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  // Landing (www): indexable, con rutas privadas/técnicas bloqueadas.
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/alumno',
          '/profesor',
          '/lector',
          '/perfil',
          '/comunidad',
          '/recursos',
          '/enlaces-invitacion',
          '/pagina',
          '/login',
          '/setup',
          '/registro',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
