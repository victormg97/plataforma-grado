'use client';

import { useTranslations } from 'next-intl';
import { Flame } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useGameProfile } from '@/lib/hooks/useComunidad';

/**
 * Shows the player's current and longest streak. When there is no streak yet
 * the values are shown as zero (Req. 4.10 / 6.8).
 */
export function StreakView() {
  const t = useTranslations('comunidadEstrategica');
  const { data: profile, isLoading } = useGameProfile();

  const current = profile?.current_streak ?? 0;
  const longest = profile?.longest_streak ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('streak_title')}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card padding="lg" className="flex items-center gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-flame)]">
            <Flame className="size-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--game-text)]">
              {isLoading ? '—' : current}
            </div>
            <div className="text-sm text-[var(--game-text-muted)]">{t('streak_current')}</div>
          </div>
        </Card>

        <Card padding="lg" className="flex items-center gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-flame)]">
            <Flame className="size-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--game-text)]">
              {isLoading ? '—' : longest}
            </div>
            <div className="text-sm text-[var(--game-text-muted)]">{t('streak_longest')}</div>
          </div>
        </Card>
      </div>

      {current === 0 && !isLoading && (
        <p className="text-sm text-[var(--game-text-muted)]">{t('streak_empty')}</p>
      )}
    </div>
  );
}
