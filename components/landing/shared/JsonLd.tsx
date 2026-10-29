import { tenantConfig } from '@/config';
import { getSiteUrl, getOgImageUrl } from '@/config/seo';

/**
 * JSON-LD (schema.org) del tenant activo para el landing.
 *
 * Usamos `Organization` (no `LocalBusiness`) porque el servicio es 100% online
 * y no tiene ubicación física. `sameAs` se arma a partir de las redes sociales
 * de los propietarios definidas en la config del tenant.
 *
 * Se renderiza en el servidor como un <script type="application/ld+json">.
 */
export function OrganizationJsonLd() {
  const siteUrl = getSiteUrl();
  const logo = getOgImageUrl();

  // Recolecta URLs de redes sociales de todos los propietarios (dedupe).
  const sameAs = Array.from(
    new Set(
      tenantConfig.propietarios.flatMap((o) => {
        const r = o.redesSociales ?? {};
        return [r.instagram, r.facebook, r.linkedin].filter(
          (u): u is string => typeof u === 'string' && u.length > 0,
        );
      }),
    ),
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: tenantConfig.nombre,
    description: tenantConfig.descripcion,
    url: siteUrl,
    ...(logo ? { logo, image: logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: {
      '@type': 'Country',
      name: 'Chile',
    },
  };

  return (
    <script
      type="application/ld+json"
      // El contenido es estático y controlado (config del tenant), no input de usuario.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
