'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { initials } from './RankingPodium';
import type { RankingEntry } from '@/lib/comunidad/quiz';

/**
 * A ranking row from 4th place on: position, initials avatar, name + level,
 * points and a thin bar relative to the leader's points. The caller's own
 * row is tinted in the accent with a "Tú" tag.
 */
export function RankingRow({
  entry,
  leaderPoints,
  highlight = false,
  index = 0,
}: {
  entry: RankingEntry;
  /** 1st place points, for the relative bar. */
  leaderPoints: number;
  highlight?: boolean;
  /** Position in the rendered list, for the entrance stagger. */
  index?: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const name = entry.display_name || entry.nickname || t('ranking_anonymous');
  const share = leaderPoints > 0 ? Math.min(entry.points / leaderPoints, 1) : 0;

  return (
    <m.li
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 rounded-[var(--game-radius-sm)] px-3 py-2.5 transition-colors',
        highlight
          ? 'bg-[var(--game-accent-muted)] ring-1 ring-[var(--game-accent)]'
          : 'hover:bg-[var(--game-surface-muted)]'
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-[var(--game-text-muted)]">
        {entry.position}
      </span>

      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
          highlight
            ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
            : 'bg-[var(--game-surface-muted)] text-[var(--game-accent)]'
        )}
      >
        {initials(name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--game-text)]">{name}</span>
          {highlight && (
            <span className="shrink-0 rounded-full bg-[var(--game-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--game-on-accent)]">
              {t('ranking_you')}
            </span>
          )}
          {entry.level != null && (
            <span className="shrink-0 rounded-full bg-[var(--game-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--game-text-muted)]">
              {t('ranking_level_short', { level: entry.level })}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--game-surface-muted)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--game-accent),var(--game-rank-gold))]"
            style={{ width: `${Math.max(Math.round(share * 100), 3)}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--game-accent)]">
        {t('ranking_points', { points: entry.points })}
      </span>
    </m.li>
  );
}
