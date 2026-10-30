'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Heart, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HudPopover } from './HudPopover';
import { HeartGauge, heartStage } from './HeartGauge';
import type { PlayerLives } from '@/lib/comunidad/game-config';

/** Formats a ms duration as mm:ss or h:mm:ss. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

// Show the mini-hearts row in the popover only for small pools.
const MAX_MINI_HEARTS = 10;

/**
 * Header lives indicator: animated heart (degrades as lives drop) +
 * current/max + a live countdown to the next regeneration.
 *
 * The countdown ticks locally each second. When it reaches zero the profile
 * query is invalidated so the server-side lazy regen is applied right away
 * (before, the header stayed at the old value until the next refetch).
 */
export function LivesIndicator({
  lives,
  regenMode,
  regenHours,
}: {
  lives: PlayerLives;
  regenMode?: 'per_life' | 'full_refill';
  regenHours?: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const current = lives.current ?? 0;
  const max = lives.max;
  const stage = heartStage(current, max);

  const nextRegenMs = lives.next_regen ? new Date(lives.next_regen).getTime() : null;
  const remaining = nextRegenMs ? nextRegenMs - now : 0;

  // Tick only while a regen is pending.
  useEffect(() => {
    if (!nextRegenMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nextRegenMs]);

  // Countdown reached zero → ask the server for the regenerated lives once.
  const refreshedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!nextRegenMs || remaining > 0) return;
    if (refreshedForRef.current === nextRegenMs) return;
    refreshedForRef.current = nextRegenMs;
    // Small grace so the server clock is surely past next_regen.
    const id = window.setTimeout(() => {
      void qc.invalidateQueries({ queryKey: ['game-profile'] });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [nextRegenMs, remaining, qc]);

  // Floating "-N" / "+N" next to the counter.
  const prevRef = useRef(current);
  const [delta, setDelta] = useState<{ key: number; value: number } | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = current;
    if (current === prev || reduceMotion) return;
    setDelta({ key: Date.now(), value: current - prev });  
  }, [current, reduceMotion]);

  const pending = !!nextRegenMs && remaining > 0;

  const trigger = (
    <div className="flex select-none items-center gap-2">
      <HeartGauge current={current} max={max} />
      <div className="relative leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{t('lives_label')}</div>
        <div className={cn('text-sm font-bold', stage === 'broken' && 'text-white/60', stage === 'critical' && 'text-[var(--game-heart)]')}>
          <m.span
            key={current}
            className="inline-block"
            initial={reduceMotion ? false : { scale: 1.35, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            {current}
          </m.span>
          <span className="text-white/60">/{max}</span>
          {pending && (
            <span className="ml-1 text-[10px] font-medium tabular-nums text-white/70">
              (+1 {formatCountdown(remaining)})
            </span>
          )}
        </div>

        <AnimatePresence>
          {delta && (
            <m.span
              key={delta.key}
              aria-hidden
              className={cn(
                'pointer-events-none absolute -right-4 top-1 text-xs font-black',
                delta.value < 0 ? 'text-[var(--game-heart)]' : 'text-emerald-300'
              )}
              initial={{ opacity: 0, y: delta.value < 0 ? -2 : 4 }}
              animate={{ opacity: [0, 1, 1, 0], y: delta.value < 0 ? 12 : -12 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              onAnimationComplete={() => setDelta(null)}
            >
              {delta.value > 0 ? `+${delta.value}` : `−${Math.abs(delta.value)}`}
            </m.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const regenText =
    regenHours && regenMode
      ? regenMode === 'full_refill'
        ? t('lives_tip_regen_full', { hours: regenHours })
        : t('lives_tip_regen_per_life', { hours: regenHours })
      : null;

  return (
    <HudPopover label={t('lives_details_label')} trigger={trigger}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">{t('lives_tip_title')}</span>
          <span className="text-sm font-bold">{t('lives_tip_count', { current, max })}</span>
        </div>

        {max <= MAX_MINI_HEARTS && (
          <div className="flex flex-wrap gap-1" aria-hidden>
            {Array.from({ length: max }, (_, i) => (
              <Heart
                key={i}
                className={cn(
                  'size-4',
                  i < current
                    ? 'fill-[var(--game-heart)] text-[var(--game-heart)]'
                    : 'fill-transparent text-white/25'
                )}
              />
            ))}
          </div>
        )}

        {stage === 'broken' ? (
          <p className="text-xs leading-snug text-[var(--game-heart)]">{t('lives_tip_empty')}</p>
        ) : stage === 'critical' ? (
          <p className="text-xs leading-snug text-amber-300">{t('lives_tip_low')}</p>
        ) : null}

        <div className="flex items-center gap-1.5 rounded-[var(--game-radius-sm)] bg-white/[0.07] px-2.5 py-2 text-xs">
          <Timer className="size-3.5 shrink-0 text-white/60" />
          <span className="tabular-nums">
            {current >= max
              ? t('lives_full')
              : t('lives_regen_in', { time: formatCountdown(Math.max(remaining, 0)) })}
          </span>
        </div>

        {regenText && <p className="text-[11px] leading-snug text-white/60">{regenText}</p>}
        <p className="text-[11px] leading-snug text-white/60">{t('lives_tip_cost')}</p>
      </div>
    </HudPopover>
  );
}
