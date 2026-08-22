'use client';

import { m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Handshake } from 'lucide-react';
import { Reveal } from '@/components/common/Reveal';
import { formatCLP, type ReferralProgramBenefits } from '@/lib/referidos/programBenefits';

interface BeneficiosDualesProps {
  benefits: ReferralProgramBenefits;
  /** Término del tenant para las sesiones, en minúsculas. Ej: "interrogaciones". */
  programa: string;
}

/**
 * Bloque de doble beneficio: lo que gana quien comparte el código (TÚ) y lo que
 * gana quien lo usa (TU REFERIDO), unidos por el medallón central.
 */
export function BeneficiosDuales({ benefits, programa }: BeneficiosDualesProps) {
  const t = useTranslations('referidos-pregunta-estrategica');

  return (
    <div className="grid items-center gap-[var(--space-md)] lg:grid-cols-[1fr_auto_1fr] lg:gap-[var(--space-lg)]">
      {/* ── Beneficio de quien comparte ── */}
      <Reveal direction="right">
        <BeneficioCard
          badge={t('beneficios.tu')}
          monto={formatCLP(benefits.referrerAmount)}
          detalle={t('beneficios.tuDetalle', { meses: benefits.durationCycles })}
          extra={t.rich('beneficios.tuAcumulable', {
            tope: formatCLP(benefits.maxAccumulated),
            b: (chunks) => (
              <strong className="font-bold text-[var(--color-brand-gold)]">{chunks}</strong>
            ),
          })}
        />
      </Reveal>

      {/* ── Medallón central ── */}
      <m.div
        initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)] shadow-[var(--shadow-md)] ring-4 ring-[var(--color-bg)] sm:size-20"
        aria-hidden
      >
        <Handshake className="size-8 text-white sm:size-10" strokeWidth={1.75} />
      </m.div>

      {/* ── Beneficio del referido ── */}
      <Reveal direction="left" delay={0.08}>
        <BeneficioCard
          badge={t('beneficios.referido')}
          monto={formatCLP(benefits.referredAmount)}
          detalle={t('beneficios.referidoDetalle', {
            meses: benefits.durationCycles,
            programa,
          })}
        />
      </Reveal>
    </div>
  );
}

// ── Tarjeta de beneficio ─────────────────────────────────────────────────────

interface BeneficioCardProps {
  badge: string;
  monto: string;
  detalle: string;
  extra?: React.ReactNode;
}

function BeneficioCard({ badge, monto, detalle, extra }: BeneficioCardProps) {
  const t = useTranslations('referidos-pregunta-estrategica');

  return (
    <article className="relative h-full rounded-[var(--radius-xl)] border border-[var(--color-brand-gold)]/25 bg-[var(--color-card,var(--color-bg))] px-5 pb-6 pt-9 text-center shadow-[var(--shadow-sm)] transition-shadow duration-300 hover:shadow-[var(--shadow-md)] sm:px-7">
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-brand-gold)] px-4 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white shadow-[var(--shadow-sm)]">
        {badge}
      </span>

      <p
        className="text-[clamp(1.25rem,3.5vw,1.75rem)] font-bold leading-tight text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('beneficios.descuento', { monto })}
      </p>

      <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
        {detalle}
      </p>

      {extra && (
        <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
          {extra}
        </p>
      )}
    </article>
  );
}
