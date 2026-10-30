'use client';

import { RankingRow } from './RankingRow';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/**
 * Standings from 4th place on (the top 3 live in the podium). Highlights the
 * caller's own row when it is in the loaded pages.
 */
export function RankingList({
  entries,
  currentUserId,
  leaderPoints,
}: {
  entries: RankingEntry[];
  currentUserId?: string;
  leaderPoints: number;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry, index) => (
        <RankingRow
          key={entry.user_id}
          entry={entry}
          index={index}
          leaderPoints={leaderPoints}
          highlight={entry.user_id === currentUserId}
        />
      ))}
    </ul>
  );
}

/** Loading placeholder: podium silhouettes and a few rows. */
export function RankingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {['h-24', 'h-32', 'h-[4.5rem]'].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="size-14 animate-pulse rounded-full bg-[var(--game-surface-muted)]" />
            <span className="h-3 w-16 animate-pulse rounded bg-[var(--game-surface-muted)]" />
            <span className={`w-full animate-pulse rounded-t-[var(--game-radius)] bg-[var(--game-surface-muted)] ${h}`} />
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-2">
            <span className="size-9 shrink-0 animate-pulse rounded-full bg-[var(--game-surface-muted)]" />
            <span className="h-3 w-32 animate-pulse rounded bg-[var(--game-surface-muted)]" />
            <span className="ml-auto h-3 w-12 animate-pulse rounded bg-[var(--game-surface-muted)]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
