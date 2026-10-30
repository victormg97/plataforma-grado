'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Flame, History, Snowflake, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameProfile } from '@/lib/hooks/useComunidad';
import type { StreakStatus } from '@/lib/comunidad/game-config';

const DAY_MS = 86_400_000;

/** Today's calendar date in the game timezone, as a UTC-midnight Date. */
function santiagoToday(): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const [y, mo, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

function parseYmd(s: string | null): Date | null {
  if (!s) return null;
  const [y, mo, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

// Embers (left %, delay s, drift px, size px).
const EMBERS = [
  { left: 30, delay: 0, x: -8, size: 5 },
  { left: 46, delay: 0.7, x: 10, size: 4 },
  { left: 58, delay: 1.4, x: -4, size: 6 },
  { left: 38, delay: 2.1, x: 12, size: 4 },
  { left: 64, delay: 1.0, x: 6, size: 3 },
];

const HERO_BG: Record<StreakStatus, string> = {
  active: 'bg-[linear-gradient(135deg,var(--game-fire-hot)_0%,var(--game-fire-deep)_45%,var(--game-header-bg)_100%)]',
  at_risk: 'bg-[linear-gradient(135deg,var(--game-fire-amber)_0%,var(--game-fire-amber-deep)_45%,var(--game-header-bg)_100%)]',
  broken: 'bg-[linear-gradient(135deg,var(--game-cold-1)_0%,var(--game-cold-2)_55%,var(--game-cold-3)_100%)]',
  none: 'bg-[linear-gradient(135deg,var(--game-ash-1)_0%,var(--game-ash-2)_55%,var(--game-header-bg)_100%)]',
};

/**
 * Streak screen: a "fire" hero with the current streak and its status, this
 * week's calendar (days kept alive light up), progress to the next milestone
 * and the previous / best streak. Everything is derived from the profile
 * (current streak + last activity date + milestones): no extra requests.
 */
export function StreakView() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const { data: profile, isLoading } = useGameProfile();

  const current = profile?.current_streak ?? 0;
  const longest = profile?.longest_streak ?? 0;
  const previous = profile?.previous_streak ?? 0;
  const status: StreakStatus = profile?.streak_status ?? 'none';
  const milestones = useMemo(
    () => (profile?.streak_milestones ?? []).filter((n) => n > 0).sort((a, b) => a - b),
    [profile?.streak_milestones]
  );
  const lit = current > 0;

  // This week (Mon → Sun) with the days covered by the current streak.
  const week = useMemo(() => {
    const today = santiagoToday();
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
    const last = parseYmd(profile?.last_activity_date ?? null);
    const first = last && current > 0 ? new Date(last.getTime() - (current - 1) * DAY_MS) : null;
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday.getTime() + i * DAY_MS);
      const inStreak = !!(first && last && day >= first && day <= last);
      const isToday = day.getTime() === today.getTime();
      const isFuture = day.getTime() > today.getTime();
      return { key: i, label: fmt.format(day), num: day.getUTCDate(), inStreak, isToday, isFuture };
    });
  }, [profile?.last_activity_date, current, locale]);

  const next = milestones.find((n) => n > current) ?? null;
  const prevMilestone = [...milestones].reverse().find((n) => n <= current) ?? 0;
  const progress = next ? (current - prevMilestone) / Math.max(next - prevMilestone, 1) : 1;

  const statusInfo = {
    active: { icon: <CheckCircle2 className="size-4" />, text: t('streak_status_active') },
    at_risk: { icon: <AlertTriangle className="size-4" />, text: t('streak_status_at_risk') },
    broken: { icon: <Snowflake className="size-4" />, text: t('streak_status_broken') },
    none: { icon: <Sparkles className="size-4" />, text: t('streak_empty') },
  }[status];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hero ── */}
      <section
        className={cn(
          'relative isolate overflow-hidden rounded-[var(--game-radius)] p-6 text-white shadow-[0_18px_40px_-20px_var(--game-fire-deep)] sm:p-8',
          HERO_BG[status]
        )}
      >
        <span aria-hidden className="game-anim-float absolute -right-12 -top-12 -z-10 size-48 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-16 left-1/3 -z-10 size-40 rounded-full bg-black/10" />

        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Flame */}
          <div className="relative flex size-32 shrink-0 items-center justify-center">
            {lit && (
              <span
                aria-hidden
                className="game-anim-glow absolute inset-0 rounded-full bg-[radial-gradient(circle,var(--game-flame-glow)_0%,transparent_65%)]"
              />
            )}
            <span className={cn('relative inline-flex', lit && 'game-anim-flicker')}>
              <Flame
                className={cn(
                  'size-24 drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]',
                  lit ? 'fill-[var(--game-flame-core)] text-white' : 'fill-white/10 text-white/50'
                )}
                strokeWidth={1.6}
              />
            </span>
            {lit &&
              EMBERS.map((e, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="game-anim-ember pointer-events-none absolute bottom-6 rounded-full bg-[var(--game-flame-core)]"
                  style={{
                    left: `${e.left}%`,
                    width: e.size,
                    height: e.size,
                    animationDelay: `${e.delay}s`,
                    ['--ember-x' as string]: `${e.x}px`,
                  }}
                />
              ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{t('streak_current')}</span>
            <div className="flex items-end gap-2 leading-none">
              <m.span
                key={current}
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="text-7xl font-black tabular-nums drop-shadow-sm"
              >
                {isLoading ? '—' : current}
              </m.span>
              <span className="pb-2 text-lg font-bold text-white/85">{t('streak_days_unit', { count: current })}</span>
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
              {statusInfo.icon}
              {statusInfo.text}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ── This week ── */}
        <section className="flex flex-col gap-4 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--game-text-muted)]">{t('streak_week_title')}</h3>
          <ol className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {week.map((d, i) => (
              <m.li
                key={d.key}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : i * 0.05 }}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'text-[11px] font-bold uppercase',
                    d.isToday ? 'text-[var(--game-accent)]' : 'text-[var(--game-text-muted)]'
                  )}
                >
                  {d.label}
                </span>
                <span
                  className={cn(
                    'relative flex aspect-square w-full max-w-12 items-center justify-center rounded-full transition-colors',
                    d.inStreak
                      ? 'bg-[linear-gradient(160deg,var(--game-fire-hot),var(--game-fire-deep))] text-white shadow-[0_6px_14px_-6px_var(--game-fire-deep)]'
                      : d.isToday
                        ? 'border-2 border-dashed border-[var(--game-flame)] text-[var(--game-flame)]'
                        : 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]',
                    d.isFuture && 'opacity-50',
                    d.isToday && !d.inStreak && status === 'at_risk' && 'motion-safe:animate-pulse'
                  )}
                  title={d.inStreak ? t('streak_day_kept') : undefined}
                >
                  {d.inStreak ? (
                    <Flame className="size-1/2 fill-[var(--game-flame-core)]" />
                  ) : (
                    <span className="text-sm font-semibold tabular-nums">{d.num}</span>
                  )}
                </span>
              </m.li>
            ))}
          </ol>
          <p className="text-xs text-[var(--game-text-muted)]">{t('streak_week_hint')}</p>
        </section>

        {/* ── Milestones ── */}
        <section className="flex flex-col gap-4 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--game-text-muted)]">{t('streak_milestones_title')}</h3>
          {milestones.length === 0 ? (
            <p className="text-sm text-[var(--game-text-muted)]">{t('streak_milestones_none')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-[var(--game-text)]">
                    {next
                      ? t('streak_next_milestone', { remaining: next - current, target: next })
                      : t('streak_all_milestones')}
                  </span>
                  {next && <span className="tabular-nums text-[var(--game-text-muted)]">{current}/{next}</span>}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--game-surface-muted)]">
                  <m.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--game-flame-core),var(--game-fire-hot),var(--game-fire-deep))]"
                    initial={{ width: reduceMotion ? `${progress * 100}%` : 0 }}
                    animate={{ width: `${Math.max(progress, 0.03) * 100}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
              </div>
              <ul className="flex flex-wrap gap-2">
                {milestones.map((n) => {
                  const reachedNow = current >= n;
                  const reachedEver = longest >= n;
                  return (
                    <li
                      key={n}
                      className={cn(
                        'flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-center',
                        reachedNow
                          ? 'bg-[linear-gradient(160deg,var(--game-fire-hot),var(--game-fire-deep))] text-white shadow-sm'
                          : reachedEver
                            ? 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                            : 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]'
                      )}
                      title={reachedEver ? t('streak_milestone_reached') : undefined}
                    >
                      <Flame className={cn('size-4', reachedNow && 'fill-[var(--game-flame-core)]')} />
                      <span className="text-sm font-black tabular-nums">{n}</span>
                      <span className="text-[9px] font-semibold uppercase">{t('streak_days_unit', { count: n })}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* ── Records ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]">
            <History className="size-6" />
          </span>
          <div>
            <div className="text-3xl font-black tabular-nums text-[var(--game-text)]">{isLoading ? '—' : previous}</div>
            <div className="text-sm text-[var(--game-text-muted)]">{t('streak_previous')}</div>
          </div>
        </div>
        <div className="relative isolate flex items-center gap-4 overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-rank-gold-light),var(--game-rank-gold))] p-5 text-[var(--game-rank-gold-dark)] shadow-[0_12px_28px_-16px_var(--game-rank-gold)]">
          <span aria-hidden className="absolute -right-6 -top-6 -z-10 size-24 rounded-full bg-white/30" />
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/50">
            <Trophy className="size-6" />
          </span>
          <div>
            <div className="text-3xl font-black tabular-nums">{isLoading ? '—' : longest}</div>
            <div className="text-sm font-medium">{t('streak_longest')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
