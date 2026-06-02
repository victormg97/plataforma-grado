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
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/*
        Layout responsive:
        - Desktop (lg+): 3 columnas a la misma altura → logo | card de registro | controles.
        - Móvil: fila superior (logo + controles) y la card debajo, con poca separación.
        Se usa `lg:contents` en la fila superior para que el logo y los controles
        pasen a ser columnas hermanas de la card en desktop, reordenadas con `order`.
      */}
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-4 px-[var(--container-padding)] py-8 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
        {/* Fila superior en móvil / columnas laterales en desktop */}
        <div className="flex items-center justify-between lg:contents">
          {/* Logo — mismo logo que el login (logoLight/Dark), responsive */}
          <div className="lg:order-1 lg:flex lg:justify-end">
            <AppLogo
              variant="login"
              style={{ maxHeight: 'clamp(40px, 10vw, 130px)' }}
            />
          </div>

          {/* Controles: WhoWeAre + toggle de modo */}
          <div className="flex items-center gap-2 lg:order-3">
            <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
            <div className="opacity-50 hover:opacity-100 transition-opacity">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Card de registro — más ancha que la de login (max-w-lg > max-w-md) */}
        <div className="w-full max-w-lg lg:order-2">{children}</div>
      </div>
    </div>
  );
}
