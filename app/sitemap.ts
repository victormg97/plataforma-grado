import type { MetadataRoute } from 'next';
import { tenantConfig } from '@/config';
import { getSiteUrl, absoluteUrl } from '@/config/seo';
import { tenantHasLanding } from '@/components/landing';

/**
 * sitemap.xml generado a partir del landing del tenant activo.
 *
 * Sólo incluye rutas públicas indexables (landing + secciones con URL propia +
 * páginas legales). La plataforma (detrás de login) queda fuera —además está
 * bloqueada en robots para el host `app.`.
 *
 * Si el tenant no tiene landing habilitado, devuelve sólo la home.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  // Tenant sin landing: sólo la raíz.
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    return [
      { url: siteUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    ];
  }

  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
  ];

  // Nota: las secciones (/programas, /planes, ...) redirigen (308) al ancla
  // dentro de "/landing" — son un único documento de scroll continuo, por eso
  // NO se listan como URLs independientes en el sitemap (evita URLs que sólo
  // redirigen). El contenido canónico es la home.

  // Páginas legales públicas.
  entries.push(
    {
      url: absoluteUrl('/terminos'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/privacidad'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  );

  return entries;
}
