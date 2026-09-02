'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, BookOpen, Flame, Sparkles } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { RecentAchievements } from '../RecentAchievements';
import type { DailyAnswerResult } from '@/lib/comunidad/answer';
import type { GameView } from '../views';

/**
 * Result of the Pregunta del Día, styled after mockup 3. Correct/incorrect
 * feedback, explanation card and points/streak are live (Slice 1). The right
 * "Logros" column is a VISUAL PLACEHOLDER for later slices (no logic).
 */
export function DailyResult({
  result,
  onNavigate,
}: {
  result: DailyAnswerResult | null;
  onNavigate: (view: GameView) => void;
}) {
  const t = useTranslations('comunidadEstrategica');

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

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Explanation card */}
        <Card padding="lg" className="border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
              <BookOpen className="size-7" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-[var(--game-text)]">{t('result_explanation_title')}</h2>
              {result.explanation ? (
                <div
                  className="prose prose-sm max-w-none leading-relaxed text-[var(--game-text)] [&_em]:italic [&_p]:mb-2 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: result.explanation }}
                />
              ) : (
                <p className="text-sm text-[var(--game-text)]">{t('result_no_explanation')}</p>
              )}
            </div>
          </div>
        </Card>

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
            <div className="text-lg font-bold text-[var(--game-text)]">{result.current_streak}</div>
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
