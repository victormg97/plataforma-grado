import type { Metadata } from 'next';
import { tenantConfig } from './index';

/**
 * Helpers centralizados de SEO/URL para el tenant activo.
 *
 * Fuente de verdad de la URL pública (www) y del host de la plataforma (app.),
 * con posibilidad de sobreescribir vía env en runtime:
 *   - NEXT_PUBLIC_SITE_URL  → URL canónica del landing (www)
 *   - NEXT_PUBLIC_APP_HOST  → hostname del subdominio de la plataforma (app.)
 *
 * Todo lo relacionado a metadata (openGraph, twitter, canonical, keywords) se
 * arma aquí para no repetir lógica en cada página.
 */

/** URL canónica pública del landing (www), sin slash final. */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    tenantConfig.seo?.siteUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/** Hostname del subdominio de la plataforma (app.), o null si no está configurado. */
export function getAppHost(): string | null {
  const host = process.env.NEXT_PUBLIC_APP_HOST || tenantConfig.seo?.appHost;
  return host ? host.replace(/^https?:\/\//, '').replace(/\/+$/, '') : null;
}

/** Construye una URL absoluta a partir de una ruta relativa, usando el siteUrl. */
export function absoluteUrl(path = '/'): string {
  const base = getSiteUrl();
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** URL absoluta de la imagen social (OG). null si el tenant no definió una. */
export function getOgImageUrl(): string | null {
  const img = tenantConfig.metadata?.ogImage;
  return img ? absoluteUrl(img) : null;
}

/**
 * Metadata base compartida por toda la app. Setea metadataBase, título con
 * plantilla, openGraph y twitter cards a partir de la config del tenant.
 * Las páginas pueden extender/override esto con su propio `generateMetadata`.
 */
export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = getOgImageUrl();
  const title = `${tenantConfig.nombre} — ${tenantConfig.descripcion}`;
  const description = tenantConfig.descripcion;
  const keywords = tenantConfig.seo?.keywords ?? [];
  const ogImageAlt = tenantConfig.seo?.ogImageAlt ?? tenantConfig.nombre;

  const favicon =
    tenantConfig.metadata?.favicon || '/tenants/cta-graduados/favicon.ico';

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s — ${tenantConfig.nombre}`,
    },
    description,
    applicationName: tenantConfig.nombre,
    keywords: keywords.length ? keywords : undefined,
    alternates: {
      canonical: '/',
    },
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
    openGraph: {
      type: 'website',
      siteName: tenantConfig.nombre,
      title,
      description,
      url: siteUrl,
      locale: 'es_CL',
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: ogImageAlt }]
        : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Metadata para una página concreta del landing. Reutiliza la base y sólo
 * sobreescribe título, descripción y canonical (ruta relativa).
 */
export function buildPageMetadata(opts: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const description = opts.description ?? tenantConfig.descripcion;
  const canonical = opts.path ?? '/';
  const ogImage = getOgImageUrl();
  const ogImageAlt = tenantConfig.seo?.ogImageAlt ?? tenantConfig.nombre;

  return {
    title: opts.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: tenantConfig.nombre,
      title: `${opts.title} — ${tenantConfig.nombre}`,
      description,
      url: absoluteUrl(canonical),
      locale: 'es_CL',
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: ogImageAlt }]
        : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `${opts.title} — ${tenantConfig.nombre}`,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
