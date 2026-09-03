'use client';

import { useTranslations } from 'next-intl';
import { Star, Sparkles, MessageSquare } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import type { WeeklyCaseMyAnswer } from '@/lib/comunidad/weekly-case';

/**
 * Player-facing grade feedback for a weekly-case answer. Rendered when an admin
 * has reviewed the answer (myAnswer.graded). Shows the quality score, the XP
 * awarded and the reviewer's written feedback.
 */
export function CaseGradeFeedback({ myAnswer }: { myAnswer: WeeklyCaseMyAnswer }) {
  const t = useTranslations('comunidadEstrategica');

  if (!myAnswer.graded) return null;

  const score = myAnswer.quality_score ?? null;
  const points = myAnswer.points_awarded ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--game-radius-sm)] border border-[var(--game-gold)]/40 bg-[var(--game-surface-muted)] p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h4 className="text-sm font-semibold text-[var(--game-text)]">
          {t('weekly_case_grade_title')}
        </h4>

        {score !== null && (
          <div className="flex items-center gap-1" aria-label={t('weekly_case_grade_quality')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`size-4 ${
                  score >= n
                    ? 'fill-[var(--game-gold)] text-[var(--game-gold)]'
                    : 'text-[var(--game-text-muted)]'
                }`}
              />
            ))}
          </div>
        )}

        {points > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--game-gold)]">
            <Sparkles className="size-4" />
            +{points} {t('result_points')}
          </span>
        )}
      </div>

      {myAnswer.feedback && (
        <div className="flex gap-2">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-[var(--game-text-muted)]" />
          <RichDescription html={myAnswer.feedback} className="text-[var(--game-text)]" />
        </div>
      )}
    </div>
  );
}
