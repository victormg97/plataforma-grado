'use client';

import { useTranslations, useLocale } from 'next-intl';
import { UserRoundPlus } from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import type { ReferralUsageEnriched } from '@/lib/referidos/types';

interface MisReferidosProps {
  usages: ReferralUsageEnriched[];
  /** Si true, se muestra la recompensa aplicada de cada referido. */
  showRewards: boolean;
}

/**
 * Listado de personas que se registraron con el código del usuario.
 * Diseño compacto acorde al resto de la vista Comunidad Estratégica.
 */
export function MisReferidos({ usages, showRewards }: MisReferidosProps) {
  const t = useTranslations('referidos-pregunta-estrategica');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))] p-[var(--space-lg)] shadow-[var(--shadow-sm)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-[clamp(1rem,2.4vw,1.25rem)] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-gold)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('misReferidos.titulo')}
        </h2>
        {usages.length > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-brand-gold)]">
            {usages.length}
          </span>
        )}
      </div>

      {usages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
            <UserRoundPlus className="size-6 text-[var(--color-text-muted)]" aria-hidden />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('misReferidos.vacioTitulo')}
          </p>
          <p className="mt-1 max-w-sm text-xs text-[var(--color-text-muted)] sm:text-sm">
            {t('misReferidos.vacioDesc')}
          </p>
        </div>
      ) : (
        <ul className="mt-[var(--space-md)] divide-y divide-[var(--color-border)]">
          {usages.map((u) => {
            const nombre = u.referred_user
              ? `${u.referred_user.nombre} ${u.referred_user.apellido}`.trim()
              : '—';
            const inicial = nombre.charAt(0).toUpperCase() || '?';
            const recompensa = u.rewards_applied?.rewards
              ?.map((r) => r.description)
              .filter(Boolean)
              .join(', ');

            return (
              <li key={u.id} className="flex items-center gap-3 py-3 first:pt-0">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-sm font-bold text-[var(--color-brand-gold)]"
                >
                  {inicial}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {nombre}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {format(new Date(u.used_at), 'PP', { locale: dateLocale })}
                  </p>
                </div>

                {showRewards && recompensa && (
                  <span className="hidden max-w-[45%] shrink-0 truncate rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] sm:block">
                    {recompensa}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
