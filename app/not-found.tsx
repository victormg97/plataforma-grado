import { getTranslations } from 'next-intl/server';
import { FileX } from 'lucide-react';
import { tenantConfig } from '@/config';

/**
 * Página 404 del tenant activo. Textos vía i18n (next-intl) y colores/branding
 * vía CSS vars del tenant. El destino del botón depende de si el tenant tiene
 * landing público (→ "/") o no (→ "/login").
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  const homeHref = tenantConfig.landingPage?.habilitado ? '/' : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
          <FileX className="size-8 text-[var(--color-brand-gold)]" />
        </div>
        <p className="mb-2 text-sm font-semibold text-[var(--color-brand-gold)]">404</p>
        <h1
          className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('titulo')}
        </h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">
          {t('descripcion')}
        </p>
        <a
          href={homeHref}
          className="inline-block rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-6 py-2.5 text-sm font-medium text-[var(--color-brand-black)] transition-colors hover:bg-[var(--color-brand-gold-hover)]"
        >
          {t('volver')}
        </a>
      </div>
    </div>
  );
}
