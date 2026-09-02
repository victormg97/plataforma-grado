'use client';

import { useTranslations } from 'next-intl';
import { Swords, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { ChallengeProgressBar } from './ChallengeProgressBar';
import type { ActiveChallenge } from '@/lib/comunidad/quiz';

/**
 * A single active challenge with the caller's progress vs the target count and
 * a completed state (Req. 12.2 / 12.3).
 */
export function ChallengeCard({ challenge }: { challenge: ActiveChallenge }) {
  const t = useTranslations('comunidadEstrategica');

  const periodLabel = t(`challenge_period_${challenge.period_type}`);

  return (
    <Card
      padding="lg"
      className="flex flex-col gap-3 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
          {challenge.completed ? <CheckCircle2 className="size-5" /> : <Swords className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-[var(--game-text)]">{challenge.title}</h3>
            <span className="ml-auto shrink-0 rounded-full bg-[var(--game-accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--game-accent)]">
              {periodLabel}
            </span>
          </div>
          {challenge.description && (
            <p className="mt-1 text-sm text-[var(--game-text-muted)]">{challenge.description}</p>
          )}
        </div>
      </div>

      <ChallengeProgressBar progress={challenge.progress_count} target={challenge.target_count} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--game-text-muted)]">
          {t('challenge_progress', {
            progress: Math.min(challenge.progress_count, challenge.target_count),
            target: challenge.target_count,
          })}
        </span>
        {challenge.completed && (
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--game-accent)]">
            <CheckCircle2 className="size-4" />
            {t('challenge_completed')}
          </span>
        )}
      </div>
    </Card>
  );
}
