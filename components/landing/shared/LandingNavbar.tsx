'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { AppLogo } from '@/components/common/AppLogo';
import { LandingThemeToggle } from './LandingThemeToggle';
import { LandingLangToggle } from './LandingLangToggle';
import type { NavLink } from '../types';

interface LandingNavbarProps {
  locale: string;
  /** Enlaces de navegación (definidos por cada tenant) */
  navLinks: NavLink[];
  /** Ruta del CTA principal: /login (no logeado) o dashboard (logeado) */
  ctaHref: string;
  /** Texto del CTA principal (ya resuelto por idioma/estado de sesión) */
  ctaLabel: string;
  /** aria-labels del botón de menú móvil */
  labels?: { abrirMenu?: string; cerrarMenu?: string };
  /** Logo personalizado del tenant. Si se omite, se usa AppLogo (logo estándar). */
  logo?: ReactNode;
}

/**
 * Navbar compartida del landing. Es agnóstica del tenant: recibe los enlaces
 * y el CTA como props. Soporta enlaces de ancla con smooth-scroll y enlaces
 * de ruta normales, con menú hamburguesa responsive.
 */
export function LandingNavbar({
  locale,
  navLinks,
  ctaHref,
  ctaLabel,
  labels,
  logo,
}: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleSectionLink(
    e: React.MouseEvent<HTMLAnchorElement>,
    link: NavLink,
  ) {
    if (!link.sectionId) {
      // Sin sección: navegación normal
      setMobileOpen(false);
      return;
    }

    const el = document.getElementById(link.sectionId);
    // Si la sección existe en la página actual (la home), hacemos smooth-scroll
    // y actualizamos la URL a la ruta limpia sin recargar.
    if (el) {
      e.preventDefault();
      setMobileOpen(false);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', link.href);
    } else {
      // La sección no está en esta página: dejar que el Link navegue.
      setMobileOpen(false);
    }
  }

  const linkClass =
    'text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 transition-colors hover:text-[var(--color-brand-gold)] hover:underline xl:text-base';
  const mobileLinkClass =
    'rounded-[var(--radius-md)] px-3 py-2.5 text-base font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]';
  const displayFont = { fontFamily: 'var(--font-display)' };

  function renderLink(link: NavLink, mobile: boolean) {
    const cls = mobile ? mobileLinkClass : linkClass;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={(e) => handleSectionLink(e, link)}
        className={cls}
        style={displayFont}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-[var(--color-bg)]/90 shadow-[var(--shadow-sm)] backdrop-blur-md'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      <nav className="container-landing flex h-16 items-center justify-between gap-4 md:h-20">
        {/* Logo */}
        <Link href="/landing" className="flex shrink-0 items-center" aria-label="Inicio">
          {logo ?? <AppLogo variant="sidebar" />}
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 lg:flex xl:gap-8">
          {navLinks.map((link) => renderLink(link, false))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <LandingLangToggle currentLocale={locale} />
          <LandingThemeToggle />
          <Link
            href={ctaHref}
            className="ml-2 hidden lg:inline-flex text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 transition-colors hover:text-[var(--color-brand-gold)] hover:underline xl:text-base"
            style={displayFont}
          >
            {ctaLabel}
          </Link>
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="ml-1 inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] lg:hidden"
            aria-label={mobileOpen ? labels?.cerrarMenu ?? 'Cerrar menú' : labels?.abrirMenu ?? 'Abrir menú'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-bg)] transition-[max-height,opacity] duration-300 lg:hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="container-landing flex flex-col gap-1 py-3">
          {navLinks.map((link) => renderLink(link, true))}
          <Link
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="mt-1 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-2.5 text-center text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
