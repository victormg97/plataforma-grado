'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Star, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { QuizReviewList } from './QuizReviewList';
import type { QuizSubmitResult } from '@/lib/comunidad/quiz';

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Quiz result: animated score ring (aciertos/total), points, newly completed
 * challenges and a per-question review (answer given, solution, explanation).
 */
export function QuizResult({
  result,
  onRestart,
}: {
  result: QuizSubmitResult;
  onRestart: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();

  const total = Math.max(result.total_presented, 1);
  const ratio = result.aciertos / total;
  const percent = Math.round(ratio * 100);
  const message =
    ratio >= 0.8 ? t('quiz_result_great') : ratio >= 0.5 ? t('quiz_result_good') : t('quiz_result_keep');
  const ringColor =
    ratio >= 0.8 ? 'var(--game-correct)' : ratio >= 0.5 ? 'var(--game-gold)' : 'var(--game-incorrect)';

  return (
    <div className="flex flex-col gap-5">
      <Card
        padding="lg"
        className="flex flex-col items-center gap-3 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
      >
        <div className="relative size-28">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="9" style={{ stroke: 'var(--game-border)' }} />
            <m.circle
              cx="50"
              cy="50"
              r={RING_R}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              style={{ stroke: ringColor }}
              initial={{ strokeDashoffset: reduceMotion ? RING_C * (1 - ratio) : RING_C }}
              animate={{ strokeDashoffset: RING_C * (1 - ratio) }}
              transition={{ duration: reduceMotion ? 0 : 1, ease: 'easeOut', delay: 0.15 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-extrabold tabular-nums text-[var(--game-text)]">
              {result.aciertos}/{result.total_presented}
            </span>
          </div>
        </div>
        {/* Percentage below the ring (inside it, longer labels hit the stroke). */}
        <span
          className="-mt-1 rounded-full px-3 py-0.5 text-xs font-semibold"
          style={{ color: ringColor, backgroundColor: `color-mix(in srgb, ${ringColor} 12%, transparent)` }}
        >
          {t('quiz_result_percent', { percent })}
        </span>

        <h2 className="text-2xl font-bold text-[var(--game-accent)]">{message}</h2>
        <p className="text-sm text-[var(--game-text-muted)]">
          {t('quiz_result_score', { aciertos: result.aciertos, total: result.total_presented })}
        </p>
        <m.div
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18, delay: reduceMotion ? 0 : 0.9 }}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--game-accent-muted)] px-4 py-1.5 text-sm font-semibold text-[var(--game-accent)]"
        >
          <Star className="size-4" />
          {t('quiz_result_points', { points: result.points_awarded })}
        </m.div>
        {result.already_submitted && (
          <p className="text-xs text-[var(--game-text-muted)]" role="status">
            {t('quiz_result_already_submitted')}
          </p>
        )}
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

      {result.details && result.details.length > 0 && <QuizReviewList details={result.details} />}

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
