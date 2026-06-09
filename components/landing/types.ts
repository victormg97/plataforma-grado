/**
 * Tipos compartidos del sistema de landing pages multi-tenant.
 *
 * Cada tenant implementa su propio diseño de landing en
 * `components/landing/tenants/<tenantId>/index.tsx` y lo registra en
 * `components/landing/index.tsx`. Todos los landings reciben las mismas props
 * base (`LandingProps`) para mantener una interfaz consistente.
 */

export interface LandingProps {
  /** Locale activo (es, en, ...) resuelto en el servidor */
  locale: string;
  /** Ruta del CTA principal: /login (no logeado) o dashboard (logeado) */
  ctaHref: string;
  /** Si el usuario tiene sesión activa */
  isLoggedIn: boolean;
}

/** Enlace de navegación de la navbar del landing */
export interface NavLink {
  /** Texto visible del enlace */
  label: string;
  /** Ruta limpia del enlace (ej. "/programas"). Es la URL que se mostrará. */
  href: string;
  /**
   * Id de la sección a la que hacer smooth-scroll dentro de la home.
   * Si se define y estamos en la home, hace scroll + actualiza la URL a `href`
   * sin recargar. Si se omite, el enlace navega normalmente.
   */
  sectionId?: string;
}
