import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LandingNavbar } from '../../shared/LandingNavbar';
import { LandingFooter } from '../../shared/LandingFooter';
import { LogoHorizontal } from './LogoHorizontal';
import type { LandingProps } from '../../types';

interface ShellProps extends LandingProps {
  children: ReactNode;
}

/**
 * Marco común de todas las páginas del landing de "pregunta-estrategica":
 * navbar + contenido + footer. Cada página (home, sobre-nosotras, contacto)
 * envuelve su contenido con este Shell para compartir navegación y pie.
 */
export async function Shell({ locale, ctaHref, isLoggedIn, children }: ShellProps) {
  const t = await getTranslations('landing-pregunta-estrategica');

  const navLinks = [
    { label: t('nav.programas'), href: '/programas', sectionId: 'programas' },
    { label: t('nav.planes'), href: '/planes', sectionId: 'planes' },
    { label: t('nav.sobreNosotras'), href: '/sobre-nosotras', sectionId: 'sobre-nosotras' },
    { label: t('nav.contacto'), href: '/contacto', sectionId: 'contacto' },
  ];

  const ctaLabel = isLoggedIn ? t('nav.irPlataforma') : t('nav.iniciaSesion');

  return (
    <>
      <LandingNavbar
        locale={locale}
        navLinks={navLinks}
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        labels={{ abrirMenu: t('nav.abrirMenu'), cerrarMenu: t('nav.cerrarMenu') }}
        logo={<LogoHorizontal className="h-9 w-auto md:h-11" />}
      />
      <main>{children}</main>
      <LandingFooter derechos={t('footer.derechos')} />
    </>
  );
}
