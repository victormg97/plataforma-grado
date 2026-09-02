'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { m, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';

/**
 * Header streak indicator. Animates the flame when the streak changes:
 *  - increase: a warm "flare up" pop.
 *  - reset to 0 (streak lost): the flame flickers and drops/fades, emphasizing
 *    that the streak went back to zero.
 * The authoritative value comes from the profile query.
 */
export function StreakIndicator({ currentStreak }: { currentStreak: number }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const prevRef = useRef(currentStreak);

  useEffect(() => {
    const prev = prevRef.current;
    if (currentStreak === prev) return;

    const lost = currentStreak === 0 && prev > 0;
    prevRef.current = currentStreak;

    if (reduceMotion) return;

    if (lost) {
      // Streak lost: flicker + shrink + dip, then settle dimmed→normal.
      controls.start({
        scale: [1, 1.1, 0.7, 0.9, 1],
        rotate: [0, -8, 8, -4, 0],
        opacity: [1, 0.5, 0.5, 0.8, 1],
        y: [0, -2, 4, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      });
    } else if (currentStreak > prev) {
      // Streak up: a flare-up pop.
      controls.start({
        scale: [1, 1.4, 1],
        transition: { duration: 0.4, ease: 'easeOut' },
      });
    }
  }, [currentStreak, controls, reduceMotion]);

  return (
    <div className="flex select-none items-center gap-2">
      <m.span animate={controls} className="inline-flex">
        <Flame className="size-6 text-[var(--game-flame)]" />
      </m.span>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/70">
          {t('streak_current')}
        </div>
        <div className="text-sm font-bold">
          {t('header_streak_days', { days: currentStreak })}
        </div>
      </div>
    </div>
  );
}
