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
    // El contenedor raíz NO usa position:relative + overflow hidden para no
    // romper el scroll. El centrado se logra con min-h-screen en el flex inner.
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/*
        Logo — esquina superior izquierda, position:absolute sobre el viewport.
        El ancestro con position que lo contiene es el body (ya que este div
        no tiene position propia), lo que es correcto.
      */}
      <div className="fixed left-4 top-4 z-10 pointer-events-none">
        <AppLogo
          variant="login"
          className="pointer-events-auto"
          style={{ maxHeight: 'clamp(40px, 12vw, 130px)' }}
        />
      </div>

      {/*
        Controles — esquina superior derecha, fixed igual que el logo.
        Sin z-index que cree contexto de apilamiento que tape el modal de
        WhoWeAre (el modal es fixed z-40/z-50, queda sobre estos controles).
      */}
      <div className="fixed right-4 top-4 z-10 flex items-center gap-2">
        <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>

      {/*
        Card centrada. padding vertical para que no quede bajo los controles
        fixed en pantallas pequeñas o cuando el formulario es largo.
      */}
      <div className="flex min-h-screen items-center justify-center px-[var(--container-padding)] py-24">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
