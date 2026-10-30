'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { format, parse } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { CalendarClock, Lock, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';
import { useMonthlyRanking } from '@/lib/hooks/useComunidad';
import { useUserStore } from '@/stores/useUserStore';
import { RankingList, RankingSkeleton } from '../ranking/RankingList';
import { RankingPodium } from '../ranking/RankingPodium';
import { MyPositionCard } from '../ranking/MyPositionCard';
import { MonthPicker } from '../ranking/MonthPicker';
import { GameErrorState } from '../GameErrorState';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/** Today's year/month/day in the game timezone. */
function santiagoToday() {
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
  return {
    ym: `${year}-${String(month).padStart(2, '0')}`,
    /** Days left in the month (0 = last day). */
    daysLeft: Math.max(daysInMonth - get('day'), 0),
  };
}

/**
 * Monthly ranking (Req. 5-8), derived from game_point_events.
 *  - One large "competition" card: month, players and closing countdown,
 *    the game's month picker (months with data only), then — after an inner
 *    divider — the podium for the top 3. The soft background glows spread
 *    across the whole card, with a gold halo behind the winner.
 *  - Standings from 4th place with bars relative to the leader + "ver más".
 *  - "Your position" closes the screen: rank of N and the gap to the place above.
 * One request per page (get_ranking_page embeds the caller's position and
 * the available months).
 */
export function RankingView() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const currentUserId = useUserStore((s) => s.user?.id);
  // Selected month lives in the URL (?mes=YYYY-MM) so a reload keeps it.
  const [monthParam, setMonth] = useShallowQueryParam('mes');
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;

  const { data, isLoading, isError, isPlaceholderData, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMonthlyRanking(month);

  const today = santiagoToday();
  const entries: RankingEntry[] = useMemo(() => data?.pages.flatMap((p) => p.entries) ?? [], [data]);
  const firstPage = data?.pages[0];
  const myPosition = firstPage?.my_position;
  const total = firstPage?.total_entries ?? 0;
  const leaderPoints = entries[0]?.points ?? 0;
  const rest = entries.filter((e) => e.position > 3);
  const months = firstPage?.available_months ?? [];

  const isCurrentMonth = month === null || month === today.ym;
  const shownMonth = month ?? today.ym;
  const rawLabel = format(parse(shownMonth, 'yyyy-MM', new Date()), 'LLLL yyyy', {
    locale: locale === 'en' ? enUS : esLocale,
  });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  const enter = (i: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: reduceMotion ? 0 : i * 0.07, ease: 'easeOut' as const },
  });

  const loadingFirst = isLoading && entries.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Competition card: header + podium ── */}
      <m.section
        {...enter(0)}
        className="relative isolate rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:p-7"
      >
        {/* Background glows (clipped here so the month panel can overflow the card) */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[var(--game-radius)]">
          <span className="game-anim-float absolute -right-16 -top-20 size-72 rounded-full bg-[radial-gradient(circle,var(--game-rank-gold-bg)_0%,transparent_70%)]" />
          <span className="absolute -left-20 top-1/3 size-64 rounded-full bg-[radial-gradient(circle,var(--game-accent-muted)_0%,transparent_70%)]" />
          <span className="game-anim-float absolute -bottom-24 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,var(--game-accent-muted)_0%,transparent_70%)] [animation-delay:-3s]" />
          {/* Halo behind the winner */}
          <span className="absolute bottom-6 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--game-rank-gold-bg)_0%,transparent_65%)]" />
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
                <span className="text-[var(--game-text-muted)]"> · {monthLabel}</span>
              </h2>
              <p className="mt-1 max-w-xl text-sm text-[var(--game-text-muted)]">{t('ranking_hero_subtitle')}</p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-60">
            <MonthPicker months={months} value={month} currentMonth={today.ym} onChange={setMonth} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--game-text)]">
            <Users className="size-3.5 text-[var(--game-accent)]" />
            {t('ranking_participants', { count: total })}
          </span>
          {isCurrentMonth ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-rank-gold-bg)] px-3 py-1 text-xs font-bold text-[var(--game-rank-gold-dark)]">
              <CalendarClock className="size-3.5" />
              {t('ranking_closes_in', { days: today.daysLeft })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--game-text-muted)]">
              <Lock className="size-3.5" />
              {t('ranking_month_closed')}
            </span>
          )}
        </div>

        {/* Inner divider with the "Podio" label on the line */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--game-border))]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--game-text-muted)]">
            {t('ranking_podium_title')}
          </span>
          <span className="h-px flex-1 bg-[linear-gradient(270deg,transparent,var(--game-border))]" />
        </div>

        {isError ? (
          <GameErrorState onRetry={() => refetch()} />
        ) : loadingFirst ? (
          <div className="mx-auto max-w-xl">
            <RankingSkeleton podiumOnly />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[var(--game-rank-gold-bg)] text-[var(--game-rank-gold-dark)]">
              <Trophy className="size-7" />
            </span>
            <p className="text-sm text-[var(--game-text-muted)]">{t('ranking_empty')}</p>
          </div>
        ) : (
          <div className={cn('mx-auto max-w-xl pt-4 transition-opacity', isPlaceholderData && 'opacity-60')}>
            <RankingPodium key={shownMonth} entries={entries} currentUserId={currentUserId} />
            {/* Floor the pedestals stand on */}
            <span aria-hidden className="block h-1.5 rounded-full bg-[linear-gradient(90deg,transparent,var(--game-border)_15%,var(--game-border)_85%,transparent)]" />
          </div>
        )}
      </m.section>

      {!isError && entries.length > 0 && (
        <>
          {/* ── Standings from 4th ── */}
          <m.section
            {...enter(1)}
            className={cn(
              'rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)] transition-opacity sm:p-6',
              isPlaceholderData && 'opacity-60'
            )}
          >
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-bold text-[var(--game-text)]">{t('ranking_list_title')}</h3>
              {rest.length > 0 && <span className="text-xs text-[var(--game-text-muted)]">{t('ranking_list_count')}</span>}
            </div>
            {rest.length > 0 ? (
              <RankingList entries={rest} currentUserId={currentUserId} leaderPoints={leaderPoints} />
            ) : (
              <p className="px-1 py-2 text-sm text-[var(--game-text-muted)]">{t('ranking_only_podium')}</p>
            )}

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
          </m.section>
        </>
      )}

      {/* ── Your position (closes the screen) ── */}
      {!isError && !loadingFirst && (
        <m.div {...enter(2)} className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
          <MyPositionCard position={myPosition} total={total} runnerUpPoints={entries[1]?.points} />
        </m.div>
      )}
    </div>
  );
}
