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
    <div className="relative min-h-screen bg-[var(--color-bg-secondary)] px-[var(--container-padding)]">
      {/*
        Logo — esquina superior izquierda, igual que el login pero con variante
        "login" (logoLight/Dark) y tamaño responsive con clamp.
        Sin z-index propio para no crear contexto de apilamiento que tape el
        modal de WhoWeAre.
      */}
      <div className="absolute left-4 top-4">
        <AppLogo
          variant="login"
          style={{ maxHeight: 'clamp(40px, 9vw, 80px)' }}
        />
      </div>

      {/*
        Controles — esquina superior derecha, igual que el layout de auth.
        Sin z-index propio (mismo motivo que el logo).
      */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>

      {/*
        Card centrada. El padding vertical (py-20) asegura que la card no quede
        tapada por el logo ni los controles en pantallas pequeñas.
        max-w-lg hace la card más ancha que la de login (max-w-md).
      */}
      <div className="flex min-h-screen items-center justify-center py-20">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
