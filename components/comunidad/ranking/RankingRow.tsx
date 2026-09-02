'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/**
 * A single ranking row: position, display name (real name or nickname), points.
 * The top 3 positions get a subtle gold-tinted emphasis.
 */
export function RankingRow({
  entry,
  highlight = false,
}: {
  entry: RankingEntry;
  highlight?: boolean;
}) {
  const t = useTranslations('comunidadEstrategica');
  const name = entry.display_name || entry.nickname || t('ranking_anonymous');
  const isPodium = entry.position <= 3;

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-[var(--game-radius)] px-3 py-2',
        highlight
          ? 'bg-[var(--game-accent-muted)] ring-1 ring-[var(--game-accent)]'
          : 'bg-[var(--game-surface)]'
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          isPodium
            ? 'bg-[var(--game-gold)] text-[var(--game-on-accent)]'
            : 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
        )}
      >
        {entry.position}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--game-text)]">{name}</span>
      <span className="shrink-0 font-semibold text-[var(--game-accent)]">
        {t('ranking_points', { points: entry.points })}
      </span>
    </li>
  );
}
