'use client';

import { useTranslations } from 'next-intl';
import { Swords } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useActiveChallenges } from '@/lib/hooks/useComunidad';
import { ChallengeCard } from '../challenges/ChallengeCard';
import { GameErrorState } from '../GameErrorState';

/**
 * Active challenges view (Req. 12): shows enabled challenges whose vigency
 * includes now, with the caller's progress and completed state.
 */
export function ChallengesView() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useActiveChallenges();

  const challenges = data?.challenges ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Swords className="size-6 text-[var(--game-accent)]" />
        <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('challenges_title')}</h2>
      </div>

      {isLoading ? (
        <div
          className="grid gap-4 sm:grid-cols-2"
          role="status"
          aria-live="polite"
          aria-label={t('loading')}
        >
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
            />
          ))}
        </div>
      ) : isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : challenges.length === 0 ? (
        <Card
          padding="lg"
          className="flex flex-col items-center gap-2 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
        >
          <Swords className="size-8 text-[var(--game-text-muted)]" />
          <p className="text-sm text-[var(--game-text-muted)]">{t('challenges_empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
