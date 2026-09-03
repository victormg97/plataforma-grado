'use client';

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';

/**
 * Fill-in-the-blank question: one text input per blank. The values array is
 * kept by the parent (index = blank index). Grading is server-side (trim +
 * case-insensitive against the accepted answers).
 */
export function QuizFillBlank({
  count,
  values,
  onChange,
}: {
  count: number;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('comunidadEstrategica');

  const setAt = (i: number, v: string) => {
    const next = [...values];
    while (next.length < count) next.push('');
    next[i] = v;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--game-text-muted)]">
        {count > 1 ? t('quiz_fill_hint_multi', { count }) : t('quiz_fill_hint_single')}
      </p>
      {Array.from({ length: count }).map((_, i) => (
        <label key={i} className="flex items-center gap-2">
          {count > 1 && (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-xs font-bold text-[var(--game-accent)]">
              {i + 1}
            </span>
          )}
          <div className="relative flex-1">
            <Pencil className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--game-text-muted)]" />
            <input
              type="text"
              value={values[i] ?? ''}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={t('quiz_fill_placeholder')}
              className="w-full rounded-[var(--game-radius-sm)] border border-[var(--game-border)] bg-[var(--game-surface-muted)] py-3 pl-9 pr-3 text-sm text-[var(--game-text)] focus:border-[var(--game-accent)] focus:outline-none"
            />
          </div>
        </label>
      ))}
    </div>
  );
}
