'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { Card } from '@/components/common/Card';
import type { MyRankingPosition } from '@/lib/comunidad/quiz';

/**
 * Shows the caller's own position in the full monthly ranking, even when they
 * are outside the visible page (Req. 8). If they have no points this month,
 * indicates they don't have a position yet (Req. 8.3).
 */
export function MyPositionCard({ position }: { position?: MyRankingPosition }) {
  const t = useTranslations('comunidadEstrategica');

  const hasPosition = position?.has_position === true;

  return (
    <Card
      padding="md"
      className="flex items-center gap-3 border-none bg-[var(--game-accent-muted)] shadow-[var(--game-shadow)]"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
        <TrendingUp className="size-5" />
      </div>
      <div className="text-sm">
        {hasPosition ? (
          <span className="font-medium text-[var(--game-text)]">
            {t('ranking_my_position', {
              position: position?.position ?? 0,
              points: position?.points ?? 0,
            })}
          </span>
        ) : (
          <span className="text-[var(--game-text-muted)]">{t('ranking_no_position')}</span>
        )}
      </div>
    </Card>
  );
}
