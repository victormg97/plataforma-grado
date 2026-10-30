'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { useActiveChallenges } from '@/lib/hooks/useComunidad';
import { ChallengeCard } from '../challenges/ChallengeCard';
import { GameErrorState } from '../GameErrorState';

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Active challenges as a quest board: a header with the overall completion
 * ring, then in-progress quests (closest to done first) followed by the
 * completed ones.
 */
export function ChallengesView() {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isError, refetch } = useActiveChallenges();

  const challenges = useMemo(() => {
    const list = data?.challenges ?? [];
    const ratio = (c: (typeof list)[number]) => c.progress_count / Math.max(c.target_count, 1);
    return [...list].sort((a, b) =>
      a.completed === b.completed ? ratio(b) - ratio(a) : a.completed ? 1 : -1
    );
  }, [data]);

  const doneCount = challenges.filter((c) => c.completed).length;
  const total = challenges.length;
  const ratio = total > 0 ? doneCount / total : 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="relative isolate flex items-center gap-4 overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] p-5 text-white shadow-[var(--game-shadow)]">
        <span aria-hidden className="game-anim-float absolute -right-10 -top-10 -z-10 size-36 rounded-full bg-white/10" />
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <Swords className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold">{t('challenges_title')}</h2>
          <p className="text-sm text-white/80">{t('challenges_subtitle')}</p>
        </div>
        {total > 0 && (
          <div className="relative size-14 shrink-0" aria-label={t('challenges_done_of', { done: doneCount, total })}>
            <svg viewBox="0 0 50 50" className="size-full -rotate-90" aria-hidden>
              <circle cx="25" cy="25" r={RING_R} fill="none" strokeWidth="5" className="stroke-white/20" />
              <m.circle
                cx="25"
                cy="25"
                r={RING_R}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                style={{ stroke: 'var(--game-rank-gold-light)' }}
                initial={{ strokeDashoffset: reduceMotion ? RING_C * (1 - ratio) : RING_C }}
                animate={{ strokeDashoffset: RING_C * (1 - ratio) }}
                transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums">
              {doneCount}/{total}
            </span>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" role="status" aria-live="polite" aria-label={t('loading')}>
          {[1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" />
          ))}
        </div>
      ) : isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--game-radius)] border-2 border-dashed border-[var(--game-border)] bg-[var(--game-surface)] px-6 py-12 text-center">
          <span className="game-anim-float flex size-16 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
            <Swords className="size-8" />
          </span>
          <p className="max-w-sm text-sm text-[var(--game-text-muted)]">{t('challenges_empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
