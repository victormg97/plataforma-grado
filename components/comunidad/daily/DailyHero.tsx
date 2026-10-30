'use client';

import { useLocale, useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Flame, Hourglass, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameProfile } from '@/lib/hooks/useComunidad';
import { formatClock, msUntilSantiagoMidnight, useNow } from '../useNow';

/**
 * Header of the Pregunta del Día: a tear-off calendar tile with today's date,
 * the streak hook ("answer to keep your N-day streak") and a live countdown to
 * the next question. After answering it shows the outcome instead.
 */
export function DailyHero({ answered, correct }: { answered?: boolean; correct?: boolean | null }) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const now = useNow(1000);
  const { data: profile } = useGameProfile();

  const today = new Date(now);
  const tz = { timeZone: 'America/Santiago' } as const;
  const day = new Intl.DateTimeFormat(locale, { ...tz, day: 'numeric' }).format(today);
  const month = new Intl.DateTimeFormat(locale, { ...tz, month: 'short' }).format(today).replace('.', '');
  const weekday = new Intl.DateTimeFormat(locale, { ...tz, weekday: 'long' }).format(today);
  const longDate = new Intl.DateTimeFormat(locale, { ...tz, day: 'numeric', month: 'long' }).format(today);

  const streak = profile?.current_streak ?? 0;
  const status = profile?.streak_status ?? 'none';

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-accent)_0%,var(--game-header-bg)_70%)] p-5 text-white shadow-[var(--game-shadow)] sm:p-6">
      <span aria-hidden className="game-anim-float absolute -right-10 -top-12 -z-10 size-44 rounded-full bg-[var(--game-gold)]/25" />
      <span aria-hidden className="absolute -bottom-14 right-1/3 -z-10 size-32 rounded-full bg-white/[0.06]" />

      <div className="flex flex-wrap items-center gap-5">
        {/* Tear-off calendar tile */}
        <m.div
          initial={reduceMotion ? false : { rotate: -8, y: -6, opacity: 0 }}
          animate={{ rotate: -3, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="flex w-20 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center shadow-[0_10px_22px_-10px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <span className="bg-[var(--game-gold)] py-1 text-[11px] font-black uppercase tracking-widest text-white">{month}</span>
          <span className="py-1 text-4xl font-black leading-none text-[var(--game-header-bg)]">{day}</span>
          <span className="pb-1.5 text-[10px] font-semibold capitalize text-[var(--game-header-bg)]/60">{weekday}</span>
        </m.div>

        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--game-gold)]">{t('daily_hero_kicker')}</span>
          <h2 className="text-2xl font-extrabold leading-tight">{t('daily_title')}</h2>
          <p className="text-sm capitalize text-white/75" suppressHydrationWarning>{longDate}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {answered ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                  correct ? 'bg-[var(--game-correct)] text-white' : 'bg-white/15 text-white'
                )}
              >
                {correct ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                {correct ? t('daily_hero_done_correct') : t('daily_hero_done_incorrect')}
              </span>
            ) : status === 'at_risk' && streak > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-fire-amber)] px-3 py-1 text-xs font-bold text-white motion-safe:animate-pulse">
                <Flame className="size-3.5 fill-[var(--game-flame-core)]" />
                {t('daily_hero_keep_streak', { days: streak })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <Flame className="size-3.5" />
                {streak > 0 ? t('daily_hero_streak', { days: streak }) : t('daily_hero_start_streak')}
              </span>
            )}
          </div>
        </div>

        {/* Countdown to the next question */}
        <div className="flex shrink-0 flex-col items-center rounded-2xl bg-black/20 px-4 py-3 backdrop-blur-sm">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
            <Hourglass className="size-3" />
            {t('daily_next_in')}
          </span>
          <span className="font-mono text-xl font-black tabular-nums" suppressHydrationWarning>{formatClock(msUntilSantiagoMidnight(now))}</span>
        </div>
      </div>
    </section>
  );
}
