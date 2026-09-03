'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link2, X } from 'lucide-react';
import type { QuizMatchRight } from '@/lib/comunidad/quiz';

/**
 * Matching question: relate each left item with a right item.
 *
 * Tap-to-connect interaction (no drag, works great on touch + desktop):
 *  1) tap a left row → it becomes "active" (highlighted).
 *  2) tap a right card → it links to the active left; both show a shared
 *     numbered color badge. Tapping a linked item again unlinks it.
 * Colors + numbers make the pairing legible on any screen size.
 *
 * `value` maps leftIndex -> right.key (original key). Reports changes upward.
 */

// A small palette of distinct pairing colors (cycled if there are many pairs).
const PAIR_COLORS = [
  '#6e1423', '#1f6feb', '#1f9d55', '#b0651f', '#8250df', '#0e7490', '#be185d', '#4d7c0f',
];

export function QuizMatching({
  left,
  right,
  value,
  onChange,
}: {
  left: string[];
  right: QuizMatchRight[];
  /** leftIndex -> assigned right.key (or undefined if unset). */
  value: Record<number, number>;
  onChange: (next: Record<number, number>) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const [activeLeft, setActiveLeft] = useState<number | null>(null);

  // right.key -> leftIndex it is linked to (reverse map).
  const keyToLeft = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [li, key] of Object.entries(value)) map[key] = Number(li);
    return map;
  }, [value]);

  const colorForLeft = (leftIndex: number) => PAIR_COLORS[leftIndex % PAIR_COLORS.length];

  const linkRight = (rightKey: number) => {
    if (activeLeft === null) {
      // If this right is already linked, tapping it unlinks.
      const li = keyToLeft[rightKey];
      if (li !== undefined) {
        const next = { ...value };
        delete next[li];
        onChange(next);
      }
      return;
    }
    // Assign the active left to this right, freeing any previous owner.
    const next = { ...value };
    const prevOwner = keyToLeft[rightKey];
    if (prevOwner !== undefined) delete next[prevOwner];
    next[activeLeft] = rightKey;
    onChange(next);
    setActiveLeft(null);
  };

  const toggleLeft = (leftIndex: number) => {
    // Tapping an already-linked left clears its link; otherwise activates it.
    if (value[leftIndex] !== undefined) {
      const next = { ...value };
      delete next[leftIndex];
      onChange(next);
      setActiveLeft(null);
      return;
    }
    setActiveLeft((cur) => (cur === leftIndex ? null : leftIndex));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--game-text-muted)]">
        {activeLeft === null ? t('quiz_match_hint') : t('quiz_match_hint_active')}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          {left.map((text, li) => {
            const linkedKey = value[li];
            const isLinked = linkedKey !== undefined;
            const isActive = activeLeft === li;
            const color = colorForLeft(li);
            return (
              <m.button
                key={li}
                type="button"
                layout={!reduceMotion}
                onClick={() => toggleLeft(li)}
                aria-pressed={isActive}
                className={cn(
                  'relative flex items-center gap-2 rounded-[var(--game-radius-sm)] border px-3 py-3 text-left text-sm transition-colors',
                  isActive
                    ? 'border-[var(--game-accent)] ring-2 ring-[var(--game-accent)]'
                    : isLinked
                      ? 'border-transparent'
                      : 'border-[var(--game-border)] bg-[var(--game-surface-muted)] hover:bg-[var(--game-accent-muted)]'
                )}
                style={isLinked && !isActive ? { backgroundColor: `${color}1a`, borderColor: color } : undefined}
              >
                {isLinked && (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {li + 1}
                  </span>
                )}
                <span className="flex-1 text-[var(--game-text)]">{text}</span>
              </m.button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2">
          {right.map((r) => {
            const linkedLeft = keyToLeft[r.key];
            const isLinked = linkedLeft !== undefined;
            const color = isLinked ? colorForLeft(linkedLeft) : null;
            const selectable = activeLeft !== null;
            return (
              <m.button
                key={r.key}
                type="button"
                layout={!reduceMotion}
                onClick={() => linkRight(r.key)}
                className={cn(
                  'relative flex items-center gap-2 rounded-[var(--game-radius-sm)] border px-3 py-3 text-left text-sm transition-colors',
                  isLinked
                    ? 'border-transparent'
                    : selectable
                      ? 'border-[var(--game-accent)]/50 bg-[var(--game-surface-muted)] hover:bg-[var(--game-accent-muted)]'
                      : 'border-[var(--game-border)] bg-[var(--game-surface-muted)]'
                )}
                style={isLinked ? { backgroundColor: `${color}1a`, borderColor: color as string } : undefined}
              >
                <span className="flex-1 text-[var(--game-text)]">{r.text}</span>
                {isLinked ? (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: color as string }}
                  >
                    {linkedLeft + 1}
                  </span>
                ) : selectable ? (
                  <Link2 className="size-4 shrink-0 text-[var(--game-accent)]" />
                ) : null}
              </m.button>
            );
          })}
        </div>
      </div>

      {/* Clear-all when there is at least one link */}
      {Object.keys(value).length > 0 && (
        <button
          type="button"
          onClick={() => {
            onChange({});
            setActiveLeft(null);
          }}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--game-text-muted)] hover:text-[var(--game-text)]"
        >
          <X className="size-3.5" />
          {t('quiz_match_clear')}
        </button>
      )}
    </div>
  );
}
