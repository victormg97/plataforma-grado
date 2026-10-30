'use client';

import { useTranslations } from 'next-intl';
import { Flame, History, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { useGameProfile } from '@/lib/hooks/useComunidad';

/**
 * Shows the player's current, previous and longest streak, plus the streak
 * status (safe today / at risk / lost). Values are zero when there is no
 * streak yet (Req. 4.10 / 6.8).
 */
export function StreakView() {
  const t = useTranslations('comunidadEstrategica');
  const { data: profile, isLoading } = useGameProfile();

  const current = profile?.current_streak ?? 0;
  const longest = profile?.longest_streak ?? 0;
  const previous = profile?.previous_streak ?? 0;
  const status = profile?.streak_status ?? 'none';

  const statusText =
    status === 'active'
      ? t('streak_status_active')
      : status === 'at_risk'
        ? t('streak_status_at_risk')
        : status === 'broken'
          ? t('streak_status_broken')
          : t('streak_empty');

  const cards = [
    {
      key: 'current',
      icon: <Flame className={cn('size-6', current > 0 ? 'text-[var(--game-flame)]' : 'text-[var(--game-text-muted)]')} />,
      value: current,
      label: t('streak_current'),
    },
    {
      key: 'previous',
      icon: <History className="size-6 text-[var(--game-text-muted)]" />,
      value: previous,
      label: t('streak_previous'),
    },
    {
      key: 'longest',
      icon: <Trophy className="size-6 text-[var(--game-gold)]" />,
      value: longest,
      label: t('streak_longest'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('streak_title')}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card
            key={c.key}
            padding="lg"
            className="flex items-center gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--game-accent-muted)]">
              {c.icon}
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--game-text)]">{isLoading ? '—' : c.value}</div>
              <div className="text-sm text-[var(--game-text-muted)]">{c.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && (
        <p
          className={cn(
            'text-sm',
            status === 'at_risk' ? 'font-medium text-[var(--game-flame)]' : 'text-[var(--game-text-muted)]'
          )}
        >
          {statusText}
        </p>
      )}
    </div>
  );
}
