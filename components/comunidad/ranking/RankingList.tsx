'use client';

import { useTranslations } from 'next-intl';
import { RankingRow } from './RankingRow';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/**
 * Paginated list of ranking rows. Highlights the caller's own row when present
 * in the loaded pages. Shows an empty state when there are no entries.
 */
export function RankingList({
  entries,
  currentUserId,
  isLoading,
}: {
  entries: RankingEntry[];
  currentUserId?: string;
  isLoading?: boolean;
}) {
  const t = useTranslations('comunidadEstrategica');

  if (isLoading && entries.length === 0) {
    return (
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] px-3 py-2"
          >
            <span className="size-8 shrink-0 animate-pulse rounded-full bg-[var(--game-surface-muted)]" />
            <span className="h-3 w-32 animate-pulse rounded bg-[var(--game-surface-muted)]" />
            <span className="ml-auto h-3 w-12 animate-pulse rounded bg-[var(--game-surface-muted)]" />
          </li>
        ))}
      </ul>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--game-text-muted)]">
        {t('ranking_empty')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <RankingRow
          key={entry.user_id}
          entry={entry}
          highlight={entry.user_id === currentUserId}
        />
      ))}
    </ul>
  );
}
