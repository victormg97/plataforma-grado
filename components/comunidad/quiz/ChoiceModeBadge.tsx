'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { CircleDot, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Makes the answer mode obvious before the player reads the options:
 *  - single:   "Una sola respuesta" (round markers).
 *  - multiple: a stronger "Selección múltiple · marca todas las correctas"
 *              banner with a live counter (square, checkbox-like markers).
 */
export function ChoiceModeBadge({
  multiple,
  selectedCount,
}: {
  multiple: boolean;
  selectedCount: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();

  if (!multiple) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--game-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--game-text-muted)]">
        <CircleDot className="size-3.5" />
        {t('choice_single')}
      </span>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--game-radius-sm)] border border-dashed border-[var(--game-accent)]/50 bg-[var(--game-accent-muted)] px-3 py-2"
      role="note"
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--game-accent)]">
        <ListChecks className="size-4" />
        {t('choice_multiple')}
      </span>
      <span className="text-xs text-[var(--game-text)]">{t('choice_multiple_hint')}</span>
      <span
        className={cn(
          'ml-auto inline-flex min-w-[5.5rem] justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-colors',
          selectedCount > 0
            ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
            : 'bg-[var(--game-surface)] text-[var(--game-text-muted)]'
        )}
        aria-live="polite"
      >
        <m.span
          key={selectedCount}
          initial={reduceMotion ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {t('choice_selected_count', { count: selectedCount })}
        </m.span>
      </span>
    </div>
  );
}
