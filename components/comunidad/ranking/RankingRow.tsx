'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankMedal, rankTier, type RankTier } from './RankMedal';
import type { RankingEntry } from '@/lib/comunidad/quiz';

// Podium styles per tier; 4th place onwards share the neutral style.
const TIER_ROW: Record<RankTier, string> = {
  gold: 'bg-[var(--game-rank-gold-bg)] border-[var(--game-rank-gold)] shadow-[0_6px_18px_-10px_var(--game-rank-gold)]',
  silver: 'bg-[var(--game-rank-silver-bg)] border-[var(--game-rank-silver)]',
  bronze: 'bg-[var(--game-rank-bronze-bg)] border-[var(--game-rank-bronze)]',
  none: 'bg-[var(--game-surface)] border-[var(--game-border)]',
};

const TIER_POINTS: Record<RankTier, string> = {
  gold: 'text-[var(--game-rank-gold-dark)]',
  silver: 'text-[var(--game-rank-silver-dark)]',
  bronze: 'text-[var(--game-rank-bronze-dark)]',
  none: 'text-[var(--game-accent)]',
};

/**
 * A single ranking row: medal/position, display name, points.
 * 1st = gold (animated medal + crown), 2nd = silver, 3rd = bronze, 4th+ =
 * one neutral style. The caller's own row gets an accent ring and a "Tú" tag.
 */
export function RankingRow({
  entry,
  highlight = false,
  index = 0,
}: {
  entry: RankingEntry;
  highlight?: boolean;
  /** Position in the rendered list, for the entrance stagger. */
  index?: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const name = entry.display_name || entry.nickname || t('ranking_anonymous');
  const tier = rankTier(entry.position);
  const isLeader = tier === 'gold';

  return (
    <m.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.04, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 rounded-[var(--game-radius)] border px-3',
        isLeader ? 'py-3' : 'py-2',
        TIER_ROW[tier],
        highlight && 'ring-2 ring-[var(--game-accent)] ring-offset-1 ring-offset-[var(--game-surface)]'
      )}
    >
      <RankMedal position={entry.position} size={isLeader ? 44 : 38} />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn('truncate text-[var(--game-text)]', isLeader ? 'text-base font-bold' : 'font-medium')}>
          {name}
        </span>
        {isLeader && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--game-rank-gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--game-rank-gold-dark)]">
            <Crown className="size-3" />
            {t('ranking_leader')}
          </span>
        )}
        {highlight && (
          <span className="shrink-0 rounded-full bg-[var(--game-accent)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--game-on-accent)]">
            {t('ranking_you')}
          </span>
        )}
      </div>

      <span className={cn('shrink-0 font-bold tabular-nums', isLeader && 'text-lg', TIER_POINTS[tier])}>
        {t('ranking_points', { points: entry.points })}
      </span>
    </m.li>
  );
}
