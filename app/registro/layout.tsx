import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { WhoWeAre } from '@/components/common/WhoWeAre';
import { AppLogo } from '@/components/common/AppLogo';
import { tenantConfig } from '@/config';
import { getLocale } from 'next-intl/server';

export default async function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    /*
     * Contenedor raíz con position:relative para anclar logo y controles.
     * El uso de `absolute` (no `fixed`) hace que logo y controles se muevan
     * con el scroll de la página en lugar de quedarse pegados al viewport.
     *
     * El padding-top (pt-24) da espacio para que la card no quede bajo el logo
     * y los controles, y el padding-bottom (pb-12) da margen al fondo.
     * `min-h-screen` garantiza que el fondo cubra toda la pantalla.
     */
    <div className="relative min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Logo — esquina superior izquierda, se mueve con el scroll */}
      <div className="absolute left-4 top-4">
        <AppLogo
          variant="login"
          style={{ maxHeight: 'clamp(40px, 12vw, 130px)' }}
        />
      </div>

      {/* Controles — esquina superior derecha, se mueven con el scroll */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>

      {/*
       * Card centrada. pt-28 da espacio sobre el logo/controles;
       * pb-12 da margen al fondo. justify-center centra horizontalmente.
       * El grid con place-items-center funciona correctamente porque el
       * contenedor crece con el contenido (sin altura fija que corte el scroll).
       */}
      <div className="grid min-h-screen place-items-center px-[var(--container-padding)] pb-12 pt-28">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
