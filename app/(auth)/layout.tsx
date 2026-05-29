import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { WhoWeAre } from '@/components/common/WhoWeAre';
import { tenantConfig } from '@/config';
import { getLocale } from 'next-intl/server';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-[var(--container-padding)]">
      {/* Top-right controls: WhoWeAre + theme toggle */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <WhoWeAre tenantSlug={tenantConfig.id} locale={locale} />
        <div className="opacity-50 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
