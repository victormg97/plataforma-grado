'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useMonthlyRanking } from '@/lib/hooks/useComunidad';
import { useUserStore } from '@/stores/useUserStore';
import { RankingList } from '../ranking/RankingList';
import { MyPositionCard } from '../ranking/MyPositionCard';
import { MonthSelector } from '../ranking/MonthSelector';
import { GameErrorState } from '../GameErrorState';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/**
 * Monthly ranking view (Req. 5-8). Derived from game_point_events aggregation.
 * Supports month history, pagination ("ver más"), and the caller's own
 * position even when outside the visible page.
 */
export function RankingView() {
  const t = useTranslations('comunidadEstrategica');
  const currentUserId = useUserStore((s) => s.user?.id);
  const [month, setMonth] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMonthlyRanking(month);

  const entries: RankingEntry[] = useMemo(
    () => data?.pages.flatMap((p) => p.entries) ?? [],
    [data]
  );
  const myPosition = data?.pages[0]?.my_position;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-[var(--game-gold)]" />
          <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('ranking_title')}</h2>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <MyPositionCard position={myPosition} />

      {isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <RankingList entries={entries} currentUserId={currentUserId} isLoading={isLoading} />

        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:opacity-60"
            >
              {isFetchingNextPage ? t('ranking_loading_more') : t('ranking_load_more')}
            </button>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
