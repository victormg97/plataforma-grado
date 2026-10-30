'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

interface SectionLinkProps {
  /** Id de la sección destino en la home (ej. "planes", "contacto"). */
  sectionId: string;
  /** Ruta limpia que se refleja en la URL (ej. "/planes"). */
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * Enlace interno a una sección de la home con smooth-scroll (sin recargar),
 * replicando el comportamiento de los enlaces del header. Actualiza la URL a la
 * ruta limpia vía history.pushState. Si la sección no está presente en la
 * página actual, deja que el <Link> navegue normalmente.
 *
 * Centraliza el patrón de scroll para reutilizarlo en el hero y en los enlaces
 * contextuales entre secciones.
 */
export function SectionLink({ sectionId, href, className, children }: SectionLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = document.getElementById(sectionId);
    if (!el) return; // no está en esta página → navegación normal del Link
    e.preventDefault();
    window.history.pushState(null, '', href);
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
