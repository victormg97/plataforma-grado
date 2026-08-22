'use client';

import { m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Check, Gift, Trophy } from 'lucide-react';
import { formatCLP, type ReferralProgramBenefits } from '@/lib/referidos/programBenefits';

interface AcumulaDescuentoProps {
  benefits: ReferralProgramBenefits;
  /** Referidos del mes en curso. Determina hasta qué nivel se ilumina. */
  referidosEsteMes: number;
  /** Si false, se omite el indicador de progreso personal. */
  mostrarProgreso: boolean;
}

/**
 * Barra de niveles de acumulación (1 → N referidos). Los niveles alcanzados
 * este mes se iluminan con el color de marca; el resto queda en gris.
 */
export function AcumulaDescuento({
  benefits,
  referidosEsteMes,
  mostrarProgreso,
}: AcumulaDescuentoProps) {
  const t = useTranslations('referidos-pregunta-estrategica');
  const { tiers } = benefits;

  const alcanzados = Math.min(referidosEsteMes, tiers.length);
  const acumulado = alcanzados > 0 ? tiers[alcanzados - 1].amount : 0;

  // El premio por meta solo tiene sentido mostrarlo cuando exige más referidos
  // que el último nivel de la escala; si no, ya está representado en la barra.
  const volumeGoal =
    benefits.volumeGoal && benefits.volumeGoal.target > tiers.length
      ? benefits.volumeGoal
      : null;
  const metaAlcanzada = !!volumeGoal && referidosEsteMes >= volumeGoal.target;

  return (
    <article className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-brand-gold)]/25 bg-[var(--color-card,var(--color-bg))] p-[var(--space-lg)] shadow-[var(--shadow-sm)]">
      <h2
        className="text-center text-[clamp(1rem,2.4vw,1.35rem)] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-gold)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('acumula.titulo')}
      </h2>

      <ol className="mt-[var(--space-lg)] flex items-start justify-between gap-1">
        {tiers.map((tier, i) => {
          const activo = i < alcanzados;

          return (
            <li
              key={tier.referrals}
              className="relative flex flex-1 flex-col items-center text-center"
            >
              {/* Conector con el nivel anterior */}
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1/2 top-[1.375rem] h-px w-full bg-[var(--color-border-strong)] sm:top-6"
                />
              )}

              <m.span
                initial={{ scale: 0.7, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={[
                  'relative z-10 flex size-11 items-center justify-center rounded-full text-lg font-bold transition-colors duration-300 sm:size-12 sm:text-xl',
                  activo
                    ? 'bg-[var(--color-brand-gold)] text-white shadow-[var(--shadow-sm)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                ].join(' ')}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {tier.referrals}
                {activo && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-bg)] ring-1 ring-[var(--color-brand-gold)]">
                    <Check className="size-2.5 text-[var(--color-brand-gold)]" strokeWidth={3} />
                  </span>
                )}
              </m.span>

              <span className="mt-2 text-[0.65rem] leading-tight text-[var(--color-text-muted)] sm:text-xs">
                {tier.referrals === 1
                  ? t('acumula.referidoSingular')
                  : t('acumula.referidoPlural')}
              </span>
              <span
                className={[
                  'text-xs font-semibold leading-tight sm:text-sm',
                  activo
                    ? 'text-[var(--color-brand-gold)]'
                    : 'text-[var(--color-text-secondary)]',
                ].join(' ')}
              >
                {formatCLP(tier.amount)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-[var(--space-md)] text-center text-[0.7rem] leading-relaxed text-[var(--color-text-muted)] sm:text-xs">
        {t('acumula.nota', { meses: benefits.durationCycles })}
      </p>

      {/* ── Premio por meta de volumen (solo si el tenant lo configuró) ── */}
      {volumeGoal && (
        <div
          className={[
            'mt-[var(--space-md)] flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed px-3 py-2.5 transition-colors',
            metaAlcanzada
              ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
              : 'border-[var(--color-border-strong)]',
          ].join(' ')}
        >
          <span
            aria-hidden
            className={[
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              metaAlcanzada
                ? 'bg-[var(--color-brand-gold)] text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-brand-gold)]',
            ].join(' ')}
          >
            <Gift className="size-4" />
          </span>

          <div className="min-w-0 text-left">
            <p className="text-xs font-bold text-[var(--color-brand-gold)] sm:text-sm">
              {metaAlcanzada
                ? t('acumula.bonusAlcanzado')
                : t('acumula.bonusTitulo', { cantidad: volumeGoal.target })}
            </p>
            <p className="text-[0.7rem] leading-relaxed text-[var(--color-text-secondary)] sm:text-xs">
              {volumeGoal.description || t('acumula.bonusDefault')}
            </p>
          </div>
        </div>
      )}

      {mostrarProgreso && (
        <div className="mt-auto pt-[var(--space-md)]">
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold-muted)] px-3 py-2.5 text-center">
            <Trophy className="size-4 shrink-0 text-[var(--color-brand-gold)]" aria-hidden />
            <p className="text-xs font-medium text-[var(--color-text-primary)] sm:text-sm">
              {t('acumula.progreso', { cantidad: referidosEsteMes })}
              {acumulado > 0 && (
                <span className="text-[var(--color-brand-gold)]">
                  {' · '}
                  {t('acumula.acumulado', { monto: formatCLP(acumulado) })}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
