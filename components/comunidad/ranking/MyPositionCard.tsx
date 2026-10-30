'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowUp, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MyRankingPosition } from '@/lib/comunidad/quiz';
import { RankMedal } from './RankMedal';

/**
 * The caller's own standing in the full monthly ranking, even outside the
 * loaded page (Req. 8). Shows the position "of N", the points, and the next
 * goal: points needed to pass the player right above (with a progress bar),
 * or the lead over 2nd place when first. Without points this month it
 * invites the player to join (Req. 8.3).
 */
export function MyPositionCard({
  position,
  total,
  runnerUpPoints,
}: {
  position?: MyRankingPosition;
  /** Players in the ranking this month. */
  total: number;
  /** Points of 2nd place (from the first page), for the leader's margin. */
  runnerUpPoints?: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();

  if (!position?.has_position) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--game-radius)] border border-dashed border-[var(--game-rank-gold)] bg-[var(--game-rank-gold-bg)] p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--game-surface)] text-[var(--game-rank-gold-dark)]">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-medium text-[var(--game-text)]">{t('ranking_no_position')}</p>
      </section>
    );
  }

  const pos = position.position ?? 0;
  const points = position.points ?? 0;
  const ahead = position.ahead_points ?? null;
  const isFirst = pos === 1;

  // Ties are broken by who got there first, so passing needs one more point.
  const gap = ahead != null ? Math.max(ahead - points + 1, 1) : 0;
  const progress = ahead ? Math.min(points / (ahead + 1), 1) : 1;
  const lead = isFirst && runnerUpPoints != null ? points - runnerUpPoints : null;

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] p-4 text-white shadow-[var(--game-shadow)] sm:p-5">
      <span aria-hidden className="absolute -right-10 -top-12 -z-10 size-40 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-16 right-24 -z-10 size-32 rounded-full bg-white/5" />

      <div className="flex items-center gap-4">
        {pos <= 3 ? (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <RankMedal position={pos} size={44} />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-full bg-white/15 leading-none">
            <span className="text-[10px] font-bold text-white/70">#</span>
            <span className="text-xl font-black tabular-nums">{pos}</span>
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-white/70">{t('ranking_my_title')}</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-black tabular-nums">#{pos}</span>
            <span className="text-sm text-white/75">{t('ranking_my_of_total', { total })}</span>
          </p>
        </div>

        <p className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-lg font-black tabular-nums">
          {t('ranking_points', { points })}
        </p>
      </div>

      <div className="mt-4">
        {isFirst ? (
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="size-4 shrink-0 fill-[var(--game-rank-gold)] text-[var(--game-rank-gold)]" />
            {lead != null && lead > 0 ? t('ranking_leading_by', { points: lead }) : t('ranking_leading_alone')}
          </p>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ArrowUp className="size-4 shrink-0" />
              {t('ranking_gap_up', { points: gap, position: pos - 1 })}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <m.div
                className={cn('h-full rounded-full bg-[linear-gradient(90deg,var(--game-rank-gold-light),var(--game-rank-gold))]')}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
