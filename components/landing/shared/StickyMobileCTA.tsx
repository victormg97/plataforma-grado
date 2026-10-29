'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StickyMobileCTAProps {
  /** Ruta del CTA principal (dashboard si hay sesión, /login si no). */
  ctaHref: string;
  /** Texto corto de contexto a la izquierda. */
  texto: string;
  /** Texto del botón. */
  boton: string;
}

/**
 * CTA fijo en la parte inferior, SOLO en móvil (< lg).
 *
 * Aparece cuando el usuario ha hecho scroll más allá del hero (para no
 * duplicar el CTA que ya vive en el hero above-the-fold) y se oculta al llegar
 * al pie de página, dejando espacio para el footer.
 */
export function StickyMobileCTA({ ctaHref, texto, boton }: StickyMobileCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrolledPastHero = window.scrollY > window.innerHeight * 0.6;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.scrollHeight - 160;
      setVisible(scrolledPastHero && !nearBottom);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur-md transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      // Respeta el safe-area inferior en iOS.
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {texto}
        </p>
        <Link
          href={ctaHref}
          tabIndex={visible ? 0 : -1}
          className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {boton}
        </Link>
      </div>
    </div>
  );
}
