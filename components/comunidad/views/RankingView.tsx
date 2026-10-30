'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { format, parse } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { CalendarClock, Lock, Trophy, Users } from 'lucide-react';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';
import { useMonthlyRanking } from '@/lib/hooks/useComunidad';
import { useUserStore } from '@/stores/useUserStore';
import { RankingList, RankingSkeleton } from '../ranking/RankingList';
import { RankingPodium } from '../ranking/RankingPodium';
import { MyPositionCard } from '../ranking/MyPositionCard';
import { MonthSelector } from '../ranking/MonthSelector';
import { GameErrorState } from '../GameErrorState';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/** Days left in the current month in the game timezone (0 = last day). */
function daysLeftInSantiagoMonth(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(daysInMonth - get('day'), 0);
}

/**
 * Monthly ranking (Req. 5-8), derived from game_point_events.
 *  - Hero: month name, players count and closing countdown (or "closed"
 *    for past months), with the month picker.
 *  - "Your position": rank of N, points and the gap to the place above.
 *  - Podium for the top 3, then the standings from 4th with bars relative
 *    to the leader, and "ver más" pagination.
 * One request per page (get_ranking_page embeds the caller's position).
 */
export function RankingView() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const currentUserId = useUserStore((s) => s.user?.id);
  // Selected month lives in the URL (?mes=YYYY-MM) so a reload keeps it.
  const [monthParam, setMonth] = useShallowQueryParam('mes');
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMonthlyRanking(month);

  const entries: RankingEntry[] = useMemo(() => data?.pages.flatMap((p) => p.entries) ?? [], [data]);
  const firstPage = data?.pages[0];
  const myPosition = firstPage?.my_position;
  const total = firstPage?.total_entries ?? 0;
  const leaderPoints = entries[0]?.points ?? 0;
  const rest = entries.filter((e) => e.position > 3);

  const isCurrentMonth = month === null;
  const monthLabel = useMemo(() => {
    const value = firstPage?.month ?? month;
    if (!value) return '';
    const label = format(parse(value, 'yyyy-MM', new Date()), 'LLLL yyyy', {
      locale: locale === 'en' ? enUS : esLocale,
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [firstPage?.month, month, locale]);
  const daysLeft = isCurrentMonth ? daysLeftInSantiagoMonth() : null;

  const enter = (i: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: reduceMotion ? 0 : i * 0.07, ease: 'easeOut' as const },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* ── Hero ── */}
      <m.section
        {...enter(0)}
        className="relative isolate overflow-visible rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:p-6"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[var(--game-radius)]">
          <span className="game-anim-float absolute -right-14 -top-16 size-56 rounded-full bg-[radial-gradient(circle,var(--game-rank-gold-bg)_0%,transparent_70%)]" />
          <span className="absolute -bottom-20 left-1/4 size-48 rounded-full bg-[radial-gradient(circle,var(--game-accent-muted)_0%,transparent_70%)]" />
        </span>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--game-rank-gold),var(--game-rank-gold-dark))] text-white shadow-[0_10px_22px_-12px_var(--game-rank-gold)]">
              <Trophy className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--game-rank-gold-dark)]">
                {t('ranking_hero_kicker')}
              </p>
              <h2 className="text-2xl font-extrabold leading-tight text-[var(--game-text)] sm:text-3xl">
                {t('ranking_title')}
                {monthLabel && <span className="text-[var(--game-text-muted)]"> · {monthLabel}</span>}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[var(--game-text-muted)]">{t('ranking_hero_subtitle')}</p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-52">
            <MonthSelector value={month} onChange={setMonth} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--game-text)]">
            <Users className="size-3.5 text-[var(--game-accent)]" />
            {t('ranking_participants', { count: total })}
          </span>
          {daysLeft != null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-rank-gold-bg)] px-3 py-1 text-xs font-bold text-[var(--game-rank-gold-dark)]">
              <CalendarClock className="size-3.5" />
              {t('ranking_closes_in', { days: daysLeft })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--game-text-muted)]">
              <Lock className="size-3.5" />
              {t('ranking_month_closed')}
            </span>
          )}
        </div>
      </m.section>

      {isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : (
        <>
          {!isLoading && (
            <m.div {...enter(1)}>
              <MyPositionCard position={myPosition} total={total} runnerUpPoints={entries[1]?.points} />
            </m.div>
          )}

          {/* ── Podium + standings ── */}
          <m.section
            {...enter(2)}
            className="rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] sm:p-6"
          >
            {isLoading && entries.length === 0 ? (
              <RankingSkeleton />
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[var(--game-rank-gold-bg)] text-[var(--game-rank-gold-dark)]">
                  <Trophy className="size-7" />
                </span>
                <p className="text-sm text-[var(--game-text-muted)]">{t('ranking_empty')}</p>
              </div>
            ) : (
              <>
                <h3 className="mb-8 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--game-text-muted)]">
                  {t('ranking_podium_title')}
                </h3>
                <div className="mx-auto max-w-xl">
                  <RankingPodium entries={entries} currentUserId={currentUserId} />
                </div>

                <div className="mt-6 border-t border-[var(--game-border)] pt-4">
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h3 className="text-sm font-bold text-[var(--game-text)]">{t('ranking_list_title')}</h3>
                    {rest.length > 0 && (
                      <span className="text-xs text-[var(--game-text-muted)]">{t('ranking_list_count')}</span>
                    )}
                  </div>
                  {rest.length > 0 ? (
                    <RankingList entries={rest} currentUserId={currentUserId} leaderPoints={leaderPoints} />
                  ) : (
                    <p className="px-1 py-3 text-sm text-[var(--game-text-muted)]">{t('ranking_only_podium')}</p>
                  )}
                </div>

                {hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] border border-[var(--game-border)] bg-[var(--game-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--game-accent)] transition-colors hover:bg-[var(--game-accent-muted)] disabled:opacity-60"
                    >
                      {isFetchingNextPage ? t('ranking_loading_more') : t('ranking_load_more')}
                    </button>
                  </div>
                )}
              </>
            )}
          </m.section>
        </>
      )}
    </div>
  );
}
