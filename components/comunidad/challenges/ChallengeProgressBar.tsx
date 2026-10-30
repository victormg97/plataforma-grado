'use client';

import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Up to this target the bar is drawn as one segment per step.
const MAX_SEGMENTS = 10;

/**
 * Quest progress bar. Small targets render as segments (one per step) that
 * fill one after another; larger targets as a smooth gradient bar. Colors
 * come from the card's --tone / --tone-deep (gold when completed).
 */
export function ChallengeProgressBar({
  progress,
  target,
  completed = false,
}: {
  progress: number;
  target: number;
  completed?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const safeTarget = Math.max(target, 1);
  const done = Math.min(progress, safeTarget);
  const pct = Math.round((done / safeTarget) * 100);
  const fill = completed
    ? 'bg-[linear-gradient(90deg,var(--game-rank-gold-light),var(--game-rank-gold))]'
    : 'bg-[linear-gradient(90deg,var(--tone),var(--tone-deep))]';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTarget}
      aria-valuenow={done}
      className="w-full"
    >
      {safeTarget <= MAX_SEGMENTS ? (
        <div className="flex gap-1">
          {Array.from({ length: safeTarget }, (_, i) => (
            <span key={i} className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--game-surface-muted)]">
              <m.span
                className={cn('block h-full rounded-full', fill)}
                initial={reduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: i < done ? 1 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, delay: reduceMotion ? 0 : 0.15 + i * 0.08 }}
                style={{ originX: 0 }}
              />
            </span>
          ))}
        </div>
      ) : (
        <div className="h-3 overflow-hidden rounded-full bg-[var(--game-surface-muted)]">
          <m.div
            className={cn('h-full rounded-full', fill)}
            initial={{ width: reduceMotion ? `${pct}%` : 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut', delay: 0.15 }}
          />
        </div>
      )}
    </div>
  );
}
