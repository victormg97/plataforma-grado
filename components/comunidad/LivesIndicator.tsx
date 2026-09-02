'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { m, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { PlayerLives } from '@/lib/comunidad/game-config';

/** Formats a ms duration as mm:ss or h:mm:ss. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const HEART_COLOR = '#e57373';

/**
 * Header lives indicator: heart + current/max, plus a live countdown to the
 * next regeneration when lives are not full. Ticks locally each second; the
 * authoritative value is refreshed by the profile query.
 *
 * The heart animates when the life count changes: a "loss" shake/dim when it
 * drops, a gentle pop when it rises. The heart is hollow (no fill) at 0.
 */
export function LivesIndicator({ lives }: { lives: PlayerLives }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const controls = useAnimationControls();

  const current = lives.current ?? 0;
  const prevCurrentRef = useRef(current);

  const nextRegenMs = lives.next_regen ? new Date(lives.next_regen).getTime() : null;

  useEffect(() => {
    if (!nextRegenMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nextRegenMs]);

  // Animate the heart when the life count changes.
  useEffect(() => {
    const prev = prevCurrentRef.current;
    if (current === prev) return;
    prevCurrentRef.current = current;

    if (reduceMotion) return;

    if (current < prev) {
      // Loss: a quick shake + shrink, like the heart takes a hit.
      controls.start({
        scale: [1, 1.25, 0.8, 1],
        rotate: [0, -12, 12, 0],
        transition: { duration: 0.45, ease: 'easeInOut' },
      });
    } else {
      // Gain: a happy pop.
      controls.start({
        scale: [1, 1.35, 1],
        transition: { duration: 0.4, ease: 'easeOut' },
      });
    }
  }, [current, controls, reduceMotion]);

  const remaining = nextRegenMs ? nextRegenMs - now : 0;
  const isEmpty = current <= 0;

  return (
    <div className="flex select-none items-center gap-2">
      <m.span animate={controls} className={`inline-flex ${isEmpty ? 'opacity-60' : ''}`}>
        <Heart
          className="size-6 text-[color:var(--heart)]"
          style={{ ['--heart' as string]: HEART_COLOR }}
          // Hollow heart at 0, filled otherwise.
          fill={isEmpty ? 'none' : HEART_COLOR}
        />
      </m.span>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{t('lives_label')}</div>
        <div className="text-sm font-bold">
          {current}
          <span className="text-white/60">/{lives.max}</span>
          {nextRegenMs && remaining > 0 && (
            <span className="ml-1 text-[10px] font-medium text-white/70">
              (+1 {formatCountdown(remaining)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
