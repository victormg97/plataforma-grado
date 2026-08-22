'use client';

import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, BadgePercent, Share2, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/common/Reveal';
import { formatCLP, type ReferralProgramBenefits } from '@/lib/referidos/programBenefits';

interface ComoFuncionaProps {
  benefits: ReferralProgramBenefits;
  programa: string;
}

/**
 * Los tres pasos del programa: comparte → invita → ambos reciben beneficio.
 */
export function ComoFunciona({ benefits, programa }: ComoFuncionaProps) {
  const t = useTranslations('referidos-pregunta-estrategica');

  const pasos: { titulo: string; desc: string; icon: LucideIcon }[] = [
    {
      titulo: t('comoFunciona.paso1Titulo'),
      desc: t('comoFunciona.paso1Desc'),
      icon: Share2,
    },
    {
      titulo: t('comoFunciona.paso2Titulo'),
      desc: t('comoFunciona.paso2Desc', { programa }),
      icon: UserPlus,
    },
    {
      titulo: t('comoFunciona.paso3Titulo'),
      desc: t('comoFunciona.paso3Desc', {
        montoReferido: formatCLP(benefits.referredAmount),
        montoReferente: formatCLP(benefits.referrerAmount),
        programa,
      }),
      icon: BadgePercent,
    },
  ];

  return (
    <section>
      <Reveal>
        <h2
          className="text-center text-[clamp(1.05rem,2.6vw,1.5rem)] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-gold)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('comoFunciona.titulo')}
        </h2>
      </Reveal>

      <Reveal delay={0.1}>
        <ol className="mt-[var(--space-md)] grid gap-[var(--space-md)] rounded-[var(--radius-xl)] border border-[var(--color-brand-gold)]/20 bg-[color-mix(in_srgb,var(--color-brand-gold)_6%,var(--color-card,var(--color-bg)))] p-[var(--space-lg)] md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start md:gap-[var(--space-sm)]">
          {pasos.map((paso, i) => (
            <PasoConSeparador key={paso.titulo} paso={paso} numero={i + 1} esUltimo={i === pasos.length - 1} />
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

// ── Paso + flecha separadora ─────────────────────────────────────────────────

function PasoConSeparador({
  paso,
  numero,
  esUltimo,
}: {
  paso: { titulo: string; desc: string; icon: LucideIcon };
  numero: number;
  esUltimo: boolean;
}) {
  const Icon = paso.icon;

  return (
    <>
      <li className="flex items-start gap-3 sm:gap-4">
        <span className="relative shrink-0">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-xl font-bold text-[var(--color-text-primary)] sm:size-14 sm:text-2xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {numero}
          </span>
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
            <Icon className="size-3.5 text-[var(--color-brand-gold)]" aria-hidden />
          </span>
        </span>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-brand-gold)] sm:text-base">
            {paso.titulo}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
            {paso.desc}
          </p>
        </div>
      </li>

      {!esUltimo && (
        <li
          role="presentation"
          aria-hidden
          className="flex items-center justify-center md:self-center"
        >
          <ArrowDown className="size-5 text-[var(--color-brand-gold)]/40 md:hidden" />
          <ArrowRight className="hidden size-5 text-[var(--color-brand-gold)]/40 md:block" />
        </li>
      )}
    </>
  );
}
