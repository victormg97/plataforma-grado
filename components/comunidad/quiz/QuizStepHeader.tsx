'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared header for the quiz pickers (subject → category).
 *
 * The toolbar row always has the same height in both steps: the back button
 * slot is reserved even when hidden, so picking a subject no longer pushes
 * the content down. A small stepper shows where the player is.
 */
export function QuizStepHeader({
  step,
  title,
  subtitle,
  onBack,
}: {
  step: 1 | 2;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();

  const steps = [t('quiz_step_subject'), t('quiz_step_category')];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 items-center justify-between gap-3">
        {onBack ? (
          <m.button
            type="button"
            onClick={onBack}
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--game-accent)]/30 bg-[var(--game-surface)] px-3.5 text-sm font-semibold text-[var(--game-accent)] shadow-[var(--game-shadow)] transition-colors hover:border-[var(--game-accent)] hover:bg-[var(--game-accent-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            {t('quiz_back_to_subjects')}
          </m.button>
        ) : (
          // Reserved slot: keeps the layout identical between steps.
          <span className="h-9" aria-hidden />
        )}

        <ol className="flex items-center gap-2 text-xs font-medium" aria-label={t('quiz_progress_label')}>
          {steps.map((label, i) => {
            const n = (i + 1) as 1 | 2;
            const active = n === step;
            const done = n < step;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="h-px w-5 bg-[var(--game-border)]" />}
                <span
                  className={cn(
                    'flex items-center gap-1.5',
                    active ? 'text-[var(--game-accent)]' : 'text-[var(--game-text-muted)]'
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                      active || done
                        ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
                        : 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]'
                    )}
                  >
                    {n}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-[var(--game-text)]">{title}</h2>
        <p className="text-sm text-[var(--game-text-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}
