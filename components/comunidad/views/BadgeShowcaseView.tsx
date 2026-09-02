'use client';

import { useTranslations } from 'next-intl';
import { Award } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useUserBadges } from '@/lib/hooks/useComunidad';
import { BadgeCard } from '../badges/BadgeCard';
import { GameErrorState } from '../GameErrorState';

/**
 * Badge showcase (Req. 7): the player's unlocked badges and the locked badges
 * available to their audience, ordered by series. Replaces the badges stub.
 */
export function BadgeShowcaseView() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useUserBadges();

  const unlocked = data?.unlocked ?? [];
  const locked = data?.locked ?? [];

  if (isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4"
        role="status"
        aria-live="polite"
        aria-label={t('loading')}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <GameErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Award className="size-6 text-[var(--game-accent)]" />
        <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('badges_title')}</h2>
      </div>

      {/* Unlocked */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
          {t('badges_unlocked_title')} ({unlocked.length})
        </h3>
        {unlocked.length === 0 ? (
          <Card
            padding="lg"
            className="flex flex-col items-center gap-2 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
          >
            <Award className="size-8 text-[var(--game-text-muted)]" />
            <p className="text-sm text-[var(--game-text-muted)]">{t('badges_unlocked_empty')}</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {unlocked.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        )}
      </section>

      {/* Locked */}
      {locked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
            {t('badges_locked_title')} ({locked.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {locked.map((b) => (
              <BadgeCard key={b.id} badge={b} locked />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
