'use client';

import { useTranslations } from 'next-intl';
import { Trophy, Star, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card } from '@/components/common/Card';
import type { QuizSubmitResult } from '@/lib/comunidad/quiz';

/**
 * Quiz result: shows aciertos/total, points awarded and any challenges newly
 * completed by this quiz (Req. 2.3 / 3 / 11.2).
 */
export function QuizResult({
  result,
  onRestart,
}: {
  result: QuizSubmitResult;
  onRestart: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <div className="flex flex-col gap-4">
      <Card
        padding="lg"
        className="flex flex-col items-center gap-3 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--game-gold)] text-[var(--game-on-accent)]">
          <Trophy className="size-7" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--game-accent)]">{t('quiz_result_title')}</h2>
        <p className="text-lg text-[var(--game-text)]">
          {t('quiz_result_score', {
            aciertos: result.aciertos,
            total: result.total_presented,
          })}
        </p>
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--game-accent-muted)] px-4 py-1.5 text-sm font-semibold text-[var(--game-accent)]">
          <Star className="size-4" />
          {t('quiz_result_points', { points: result.points_awarded })}
        </div>
      </Card>

      {result.completed_challenges.length > 0 && (
        <Card padding="md" className="flex flex-col gap-2 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="text-sm font-semibold text-[var(--game-text)]">
            {t('quiz_result_challenges_title')}
          </div>
          <ul className="flex flex-col gap-1.5">
            {result.completed_challenges.map((c) => (
              <li key={c.challenge_id} className="inline-flex items-center gap-2 text-sm text-[var(--game-accent)]">
                <CheckCircle2 className="size-4 shrink-0" />
                {c.title}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
        >
          <RotateCcw className="size-4" />
          {t('quiz_result_again')}
        </button>
      </div>
    </div>
  );
}
