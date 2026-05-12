'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Step = 'alumnos' | 'horario' | 'revision';

export interface StepIndicatorProps {
  steps: Step[];
  currentStep: Step;
  t: ReturnType<typeof useTranslations<'programas'>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepIndicator({ steps, currentStep, t }: StepIndicatorProps) {
  const stepIndex = steps.indexOf(currentStep);

  return (
    <div className="mb-5 flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              i < stepIndex
                ? 'bg-[var(--color-brand-gold)] text-white'
                : i === stepIndex
                ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] ring-2 ring-[var(--color-brand-gold)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            )}
          >
            {i < stepIndex ? <Check className="size-3.5" /> : i + 1}
          </div>
          <span className={cn('text-xs', i === stepIndex ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]')}>
            {t(`wizard.paso.${s}` as Parameters<typeof t>[0])}
          </span>
          {i < steps.length - 1 && (
            <div className={cn('h-px w-8', i < stepIndex ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]')} />
          )}
        </div>
      ))}
    </div>
  );
}
