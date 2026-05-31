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
    <div className="relative min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Logo arriba a la izquierda */}
      <div className="absolute left-4 top-4 z-10">
        <AppLogo variant="sidebar" />
      </div>

      {/* Controles arriba a la derecha: WhoWeAre + toggle de modo */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>

      {/* Contenido centrado; el card de registro es más ancho que el de login (max-w-lg > max-w-md) */}
      <div className="flex min-h-screen items-center justify-center px-[var(--container-padding)] py-20">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
