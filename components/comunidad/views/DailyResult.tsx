'use client';

import { useTranslations } from 'next-intl';
import { GameRichText } from '../GameRichText';
import { CheckCircle2, XCircle, BookOpen, Flame, Sparkles } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { RecentAchievements } from '../RecentAchievements';
import { DailyAnswerReviewCard } from '../DailyReviewPanel';
import { useDailyReview, useGameProfile } from '@/lib/hooks/useComunidad';
import type { DailyAnswerResult } from '@/lib/comunidad/answer';
import type { GameView } from '../views';

/**
 * Result of the Pregunta del Día, styled after mockup 3: correct/incorrect
 * banner, explanation, points, streak and recent achievements. Survives a
 * page reload by rebuilding the result from today's daily review.
 */
export function DailyResult({
  result: resultProp,
  onNavigate,
}: {
  result: DailyAnswerResult | null;
  onNavigate: (view: GameView) => void;
}) {
  const liveResult = resultProp;
  const t = useTranslations('comunidadEstrategica');
  // The profile is the source of truth for the streak (the RPC echoes the
  // stored value, which can be stale when the daily source doesn't count).
  const { data: profile } = useGameProfile();
  // After a reload the in-memory result is gone: rebuild it from today's
  // review (already in the cache from the bootstrap, no extra request).
  // The review also powers the "correct answer" card (seeded by the answer
  // response, so it's already in cache: no extra request).
  const { data: review, isLoading: reviewLoading } = useDailyReview();

  const result: Pick<DailyAnswerResult, 'is_correct' | 'explanation' | 'points_awarded'> | null =
    liveResult ??
    (review?.answered
      ? {
          is_correct: !!review.is_correct,
          explanation: review.question?.explanation ?? null,
          points_awarded: review.points_awarded ?? 0,
        }
      : null);

  if (!result && reviewLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label={t('loading')}>
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!result) {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('result_none')}</p>
        <button
          type="button"
          onClick={() => onNavigate('daily')}
          className="mt-4 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
        >
          {t('result_back_daily')}
        </button>
      </Card>
    );
  }

  const correct = result.is_correct;

  return (
    <div className="flex flex-col gap-5">
      {/* Prominent, centered correct/incorrect banner so the outcome is obvious */}
      <div
        className={`flex flex-col items-center gap-2 rounded-[var(--game-radius)] px-6 py-6 text-center ${
          correct
            ? 'bg-[var(--game-correct)]/12'
            : 'bg-[var(--game-incorrect)]/12'
        }`}
        role="status"
        aria-live="polite"
      >
        {correct ? (
          <CheckCircle2 className="size-14 text-[var(--game-correct)]" />
        ) : (
          <XCircle className="size-14 text-[var(--game-incorrect)]" />
        )}
        <span
          className={`text-2xl font-extrabold ${
            correct ? 'text-[var(--game-correct)]' : 'text-[var(--game-incorrect)]'
          }`}
        >
          {correct ? t('result_correct') : t('result_incorrect')}
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
        {/* The question with the player's pick and the correct answer, right
            away (the review comes seeded in the answer response). */}
        {review?.answered && review.question && <DailyAnswerReviewCard data={review} />}

        {/* Explanation card */}
        <Card padding="lg" className="border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
              <BookOpen className="size-7" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-[var(--game-text)]">{t('result_explanation_title')}</h2>
              {result.explanation ? (
                <GameRichText html={result.explanation} variant="body" />
              ) : (
                <p className="text-sm text-[var(--game-text)]">{t('result_no_explanation')}</p>
              )}
            </div>
          </div>
        </Card>
        </div>

        {/* Recent achievements — real data */}
        <RecentAchievements onSeeMore={() => onNavigate('badges')} />
      </div>

      {/* Points + streak summary (live) */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card padding="md" className="flex items-center gap-3 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <Sparkles className="size-5 text-[var(--game-gold)]" />
          <div>
            <div className="text-lg font-bold text-[var(--game-text)]">+{result.points_awarded}</div>
            <div className="text-xs text-[var(--game-text-muted)]">{t('result_points')}</div>
          </div>
        </Card>
        <Card padding="md" className="flex items-center gap-3 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <Flame className="size-5 text-[var(--game-flame)]" />
          <div>
            <div className="text-lg font-bold text-[var(--game-text)]">{profile?.current_streak ?? liveResult?.current_streak ?? 0}</div>
            <div className="text-xs text-[var(--game-text-muted)]">{t('streak_current')}</div>
          </div>
        </Card>
      </div>

      {/* Siguiente */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="w-full max-w-md rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] py-3 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
        >
          {t('result_next')}
        </button>
      </div>
    </div>
  );
}
