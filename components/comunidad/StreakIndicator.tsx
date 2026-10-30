'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, animate, m, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Flame, Trophy, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HudPopover } from './HudPopover';
import type { StreakStatus } from '@/lib/comunidad/game-config';
import { playerKey, readPlayerItem, writePlayerItem } from '@/lib/comunidad/player-storage';

const LOSS_SEEN_NAME = 'streak-loss-seen';
const LOSS_BUBBLE_MS = 6000;

// Smoke puffs released when the flame goes out (x drift px, delay s, size px).
const SMOKE = [
  { x: -7, delay: 0, size: 9 },
  { x: 5, delay: 0.12, size: 11 },
  { x: -2, delay: 0.26, size: 8 },
  { x: 8, delay: 0.4, size: 7 },
  { x: -9, delay: 0.52, size: 6 },
];

// Sparks thrown when the streak grows (angle deg, distance px).
const SPARKS = [-70, -35, 0, 35, 70, 110, -110].map((deg, i) => ({
  deg,
  dist: 16 + (i % 3) * 5,
}));


/**
 * Header streak indicator (flame + day count) with game-style feedback:
 *  - active:  lit flame with an idle flicker and warm glow.
 *  - at_risk: lit flame with a pulsing "!" (play today to keep it).
 *  - broken:  the first time the player sees a lost streak, the flame
 *             struggles, goes out in a puff of smoke, the counter drains from
 *             the old value to 0 and a bubble explains what happened. The
 *             replay is suppressed per (last_activity_date, lost value).
 *  - growth:  flare-up with sparks and a floating "+N".
 * Hover/focus/tap opens a popover with current, previous and best streak.
 */
export function StreakIndicator({
  currentStreak,
  longestStreak,
  previousStreak,
  status,
  lastActivityDate,
  userId,
}: {
  currentStreak: number;
  longestStreak: number;
  previousStreak: number;
  status: StreakStatus;
  lastActivityDate: string | null;
  /** Per-user memory of the loss animation (shared browsers). */
  userId: string | null;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const flame = useAnimationControls();
  const counter = useAnimationControls();

  // While the loss sequence runs, the counter shows `override` (draining from
  // the lost value to 0); otherwise it shows the authoritative value.
  const [override, setOverride] = useState<number | null>(null);
  const [losing, setLosing] = useState(false);
  const [smokeKey, setSmokeKey] = useState<number | null>(null);
  const [lossDelta, setLossDelta] = useState<number | null>(null);
  const [gain, setGain] = useState<{ key: number; delta: number } | null>(null);
  const [lossBubble, setLossBubble] = useState<number | null>(null);

  const prevRef = useRef(currentStreak);
  const runningRef = useRef(false);

  const display = override ?? currentStreak;
  const lit = display > 0;

  // ── Streak lost: play the "flame goes out" sequence once ──
  const playLoss = useCallback(
    async (from: number) => {
      if (runningRef.current) return;
      runningRef.current = true;

      if (reduceMotion) {
        setLossBubble(from);
        runningRef.current = false;
        return;
      }

      setLosing(true);
      setOverride(from);

      // 1) The flame struggles against the wind.
      await flame.start({
        rotate: [0, -14, 10, -12, 8, -4, 0],
        scale: [1, 1.12, 0.92, 1.08, 0.86, 0.95, 0.9],
        x: [0, -1.5, 1.5, -1, 1, 0, 0],
        transition: { duration: 0.85, ease: 'easeInOut' },
      });

      // 2) It goes out: shrinks + sinks, smoke rises, counter drains.
      setSmokeKey(Date.now());
      setLossDelta(from);
      window.setTimeout(() => setSmokeKey(null), 2000);
      window.setTimeout(() => setLossDelta(null), 1300);
      void counter.start({
        x: [0, -3, 3, -2, 2, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      });
      const drain = animate(from, 0, {
        duration: Math.min(0.35 + from * 0.08, 1.4),
        ease: 'easeIn',
        onUpdate: (v) => setOverride(Math.round(v)),
      });
      await Promise.all([
        flame.start({
          scale: 0.35,
          y: 5,
          opacity: 0.25,
          rotate: 0,
          x: 0,
          transition: { duration: 0.5, ease: [0.6, 0, 0.9, 0.4] },
        }),
        drain.then(() => undefined),
      ]);
      setOverride(0);

      // 3) A small ember re-lights (gray): "you can start again".
      await flame.start({
        scale: [0.35, 1.15, 1],
        y: [5, -1, 0],
        opacity: [0.25, 1, 1],
        transition: { duration: 0.55, ease: 'easeOut' },
      });

      setOverride(null);
      setLosing(false);
      setLossBubble(from);
      runningRef.current = false;
    },
    [flame, counter, reduceMotion]
  );

  // Detect a lost streak (first time per lost streak, per player).
  useEffect(() => {
    if (status !== 'broken' || previousStreak <= 0 || !userId) return;
    const key = playerKey(userId, LOSS_SEEN_NAME);
    const token = `${lastActivityDate ?? ''}:${previousStreak}`;
    if (readPlayerItem<string>(key) === token) return;
    // Mark as seen only when it actually starts (StrictMode-safe).
    const id = window.setTimeout(() => {
      writePlayerItem(key, token);
      void playLoss(previousStreak);
    }, 650);
    return () => window.clearTimeout(id);
  }, [status, previousStreak, lastActivityDate, userId, playLoss]);

  // Streak grew (answered today): flare-up + sparks + "+N".
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = currentStreak;
    if (currentStreak <= prev || runningRef.current) return;

    setLossBubble(null); // eslint-disable-line react-hooks/set-state-in-effect
    if (reduceMotion) return;
    setGain({ key: Date.now(), delta: currentStreak - prev });
    void flame.start({
      scale: [1, 1.55, 0.9, 1.12, 1],
      rotate: [0, -8, 6, 0, 0],
      y: [0, -3, 0, 0, 0],
      transition: { duration: 0.7, ease: 'easeOut' },
    });
  }, [currentStreak, flame, reduceMotion]);

  // Auto-dismiss the loss bubble.
  useEffect(() => {
    if (lossBubble === null) return;
    const id = window.setTimeout(() => setLossBubble(null), LOSS_BUBBLE_MS);
    return () => window.clearTimeout(id);
  }, [lossBubble]);

  const statusText =
    status === 'active'
      ? t('streak_status_active')
      : status === 'at_risk'
        ? t('streak_status_at_risk')
        : status === 'broken'
          ? t('streak_status_broken')
          : t('streak_status_none');

  const statusTone =
    status === 'active'
      ? 'text-emerald-300'
      : status === 'at_risk'
        ? 'text-amber-300'
        : 'text-white/70';

  const trigger = (
    <div className="flex select-none items-center gap-2">
      <span className="relative inline-flex size-7 items-center justify-center">
        {/* Warm glow behind a lit flame */}
        {lit && !losing && (
          <span
            aria-hidden
            className={cn(
              'absolute inset-[-6px] rounded-full bg-[radial-gradient(circle,var(--game-flame-glow)_0%,transparent_70%)]',
              status === 'active' && 'game-anim-glow'
            )}
          />
        )}

        <m.span animate={flame} className="relative inline-flex" style={{ transformOrigin: '50% 85%' }}>
          <span className={cn('inline-flex', lit && !losing && 'game-anim-flicker')}>
            <Flame
              className={cn(
                'size-6 transition-colors duration-500',
                lit
                  ? 'fill-[var(--game-flame-core)] text-[var(--game-flame)]'
                  : 'fill-transparent text-white/40'
              )}
              fillOpacity={lit ? 0.55 : 0}
            />
          </span>
        </m.span>

        {/* At-risk hint */}
        {status === 'at_risk' && !losing && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black leading-none text-[var(--game-popover-bg)] motion-safe:animate-pulse"
          >
            !
          </span>
        )}

        {/* Smoke when the flame goes out */}
        <AnimatePresence>
          {smokeKey !== null && (
            <span key={`smoke-${smokeKey}`} aria-hidden className="pointer-events-none absolute inset-0">
              {SMOKE.map((s, i) => (
                <m.span
                  key={i}
                  className="absolute left-1/2 top-1 rounded-full bg-[var(--game-smoke)] blur-[1.5px]"
                  style={{ width: s.size, height: s.size, marginLeft: -s.size / 2 }}
                  initial={{ opacity: 0, y: 0, x: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 0.85, 0], y: -30, x: s.x, scale: 1.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, delay: s.delay, ease: 'easeOut' }}
                />
              ))}
            </span>
          )}
        </AnimatePresence>

        {/* Sparks when the streak grows */}
        <AnimatePresence>
          {gain && (
            <span key={`spark-${gain.key}`} aria-hidden className="pointer-events-none absolute inset-0">
              {SPARKS.map((s, i) => {
                const rad = (s.deg - 90) * (Math.PI / 180);
                return (
                  <m.span
                    key={i}
                    className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-[var(--game-flame-core)]"
                    style={{ marginLeft: -3, marginTop: -3 }}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{ opacity: 0, x: Math.cos(rad) * s.dist, y: Math.sin(rad) * s.dist, scale: 0.3 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    onAnimationComplete={i === 0 ? () => setGain(null) : undefined}
                  />
                );
              })}
            </span>
          )}
        </AnimatePresence>
      </span>

      <div className="relative leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{t('streak_current')}</div>
        <m.div animate={counter} className={cn('text-sm font-bold transition-colors duration-500', !lit && 'text-white/60')}>
          <m.span
            key={display}
            className="inline-block"
            initial={reduceMotion ? false : { y: -6, opacity: 0.2 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {t('header_streak_days', { days: display })}
          </m.span>
        </m.div>

        {/* Floating delta: "-N" falls (loss) / "+N" rises (gain) */}
        <AnimatePresence>
          {lossDelta !== null && (
            <m.span
              key="loss-delta"
              aria-hidden
              className="pointer-events-none absolute -right-5 top-3 text-xs font-black text-[var(--game-heart)]"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: [0, 1, 1, 0], y: 14 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeIn' }}
            >
              −{lossDelta}
            </m.span>
          )}
          {gain && (
            <m.span
              key={`gain-${gain.key}`}
              aria-hidden
              className="pointer-events-none absolute -right-5 top-2 text-xs font-black text-[var(--game-flame-core)]"
              initial={{ opacity: 0, y: 4, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: -14, scale: 1.1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              +{gain.delta}
            </m.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const lossContent =
    lossBubble !== null ? (
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Flame className="size-4 text-white/50" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold">{t('streak_lost_title')}</div>
          <p className="mt-0.5 text-xs leading-snug text-white/80">
            {t('streak_lost_desc', { days: lossBubble })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLossBubble(null)}
          aria-label={t('streak_lost_dismiss')}
          className="-mr-1 -mt-1 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    ) : null;

  return (
    <HudPopover
      label={t('streak_details_label')}
      trigger={trigger}
      forcedOpen={lossBubble !== null}
      pinnedContent={lossContent}
      onDismissPinned={() => setLossBubble(null)}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {t('streak_tip_title')}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold">
            <Flame className={cn('size-4', currentStreak > 0 ? 'text-[var(--game-flame)]' : 'text-white/40')} />
            {t('header_streak_days', { days: currentStreak })}
          </span>
        </div>
        <p className={cn('text-xs leading-snug', statusTone)}>{statusText}</p>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            icon={<History className="size-3.5" />}
            label={t('streak_previous')}
            value={previousStreak > 0 ? t('header_streak_days', { days: previousStreak }) : t('streak_previous_none')}
          />
          <StatTile
            icon={<Trophy className="size-3.5 text-[var(--game-gold)]" />}
            label={t('streak_longest')}
            value={t('header_streak_days', { days: longestStreak })}
          />
        </div>
      </div>
    </HudPopover>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--game-radius-sm)] bg-white/[0.07] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/60">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
