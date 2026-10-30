'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { animate, m, useReducedMotion } from 'framer-motion';
import { BookOpen, Check, Flame, Hourglass, ListChecks, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { GameRichText } from '../GameRichText';
import { RecentAchievements } from '../RecentAchievements';
import { DailyAnswerReviewCard } from '../DailyReviewPanel';
import { formatClock, msUntilSantiagoMidnight, useNow } from '../useNow';
import { useDailyReview, useGameProfile } from '@/lib/hooks/useComunidad';
import type { DailyAnswerResult } from '@/lib/comunidad/answer';
import type { GameView } from '../views';

// Confetti pieces for a correct answer (angle deg, distance px, rotation, delay s).
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  deg: (360 / 18) * i + (i % 2 ? 8 : -8),
  dist: 70 + (i % 4) * 18,
  rot: (i % 2 ? 1 : -1) * (180 + i * 20),
  delay: (i % 5) * 0.03,
  tone: ['var(--game-gold)', 'var(--game-correct)', 'var(--game-accent)', 'var(--game-flame-core)'][i % 4],
  shape: i % 3 === 0 ? 'rounded-full' : 'rounded-[2px]',
}));

/** Animated "+N" counter. */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, value, {
      duration: 0.9,
      delay: 0.35,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);
  return <>{reduceMotion ? value : shown}</>;
}

/**
 * Result of the Pregunta del Día: a celebratory banner (confetti + bouncing
 * check when correct, a gentle shake when not), animated points and streak,
 * the question with the correct answer, the explanation and achievements.
 * Survives a reload by rebuilding the result from today's review (cache).
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
  const reduceMotion = useReducedMotion();
  const now = useNow(1000);
  // Profile = source of truth for the streak; review = answer + solution
  // (seeded by the answer response, already in cache).
  const { data: profile } = useGameProfile();
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
  const streak = profile?.current_streak ?? liveResult?.current_streak ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Outcome banner ── */}
      <section
        role="status"
        aria-live="polite"
        className={cn(
          'relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-[var(--game-radius)] px-6 py-8 text-center text-white shadow-[var(--game-shadow)]',
          correct
            ? 'bg-[linear-gradient(135deg,var(--game-correct),var(--quiz-tone-emerald-deep))]'
            : 'bg-[linear-gradient(135deg,var(--game-incorrect),var(--game-header-bg))]'
        )}
      >
        <span aria-hidden className="game-anim-float absolute -left-10 -top-10 -z-10 size-40 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-12 -right-6 -z-10 size-36 rounded-full bg-black/10" />

        <div className="relative flex size-20 items-center justify-center">
          {correct && !reduceMotion && (
            <span aria-hidden className="pointer-events-none absolute inset-0">
              {CONFETTI.map((c, i) => {
                const rad = (c.deg * Math.PI) / 180;
                return (
                  <m.span
                    key={i}
                    className={cn('absolute left-1/2 top-1/2 size-2', c.shape)}
                    style={{ background: c.tone, marginLeft: -4, marginTop: -4 }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
                    animate={{
                      x: Math.cos(rad) * c.dist,
                      y: [0, Math.sin(rad) * c.dist, Math.sin(rad) * c.dist + 40],
                      opacity: [1, 1, 0],
                      rotate: c.rot,
                      scale: 1,
                    }}
                    transition={{ duration: 1.4, delay: 0.15 + c.delay, ease: 'easeOut' }}
                  />
                );
              })}
            </span>
          )}
          <m.span
            initial={reduceMotion ? false : correct ? { scale: 0, rotate: -45 } : { scale: 0.6 }}
            animate={correct ? { scale: 1, rotate: 0 } : { scale: 1, x: reduceMotion ? 0 : [0, -8, 8, -6, 6, 0] }}
            transition={correct ? { type: 'spring', stiffness: 320, damping: 14 } : { duration: 0.5, delay: 0.1 }}
            className="flex size-20 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30"
          >
            {correct ? <Check className="size-10" strokeWidth={3} /> : <X className="size-10" strokeWidth={3} />}
          </m.span>
        </div>

        <div>
          <div className="text-3xl font-black">{correct ? t('result_correct') : t('result_incorrect')}</div>
          <p className="mt-1 text-sm text-white/85">{correct ? t('daily_result_cheer') : t('daily_result_keep')}</p>
        </div>

        {/* Rewards */}
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-black text-[var(--game-gold)] shadow-sm">
            <Sparkles className="size-4" />+<CountUp value={result.points_awarded} /> {t('result_points')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-4 py-1.5 text-sm font-bold">
            <Flame className="size-4 fill-[var(--game-flame-core)] text-[var(--game-flame-core)]" />
            {t('daily_hero_streak', { days: streak })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-4 py-1.5 text-sm font-semibold" suppressHydrationWarning>
            <Hourglass className="size-4" />
            {t('daily_next_in')} {formatClock(msUntilSantiagoMidnight(now))}
          </span>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* The question with the player's pick and the correct answer. */}
          {review?.answered && review.question && <DailyAnswerReviewCard data={review} />}

          {/* Explanation */}
          <section className="flex gap-4 rounded-[var(--game-radius)] border-l-4 border-[var(--game-gold)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] text-white">
              <BookOpen className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="text-lg font-bold text-[var(--game-text)]">{t('result_explanation_title')}</h2>
              {result.explanation ? (
                <GameRichText html={result.explanation} variant="body" />
              ) : (
                <p className="text-sm text-[var(--game-text)]">{t('result_no_explanation')}</p>
              )}
            </div>
          </section>
        </div>

        <RecentAchievements onSeeMore={() => onNavigate('badges')} />
      </div>

      {/* Next steps */}
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onNavigate('quiz')}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--game-radius-sm)] bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-14px_var(--game-accent)] transition-all hover:brightness-110"
        >
          <ListChecks className="size-4" />
          {t('daily_result_more_practice')}
        </button>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="rounded-[var(--game-radius-sm)] border-2 border-[var(--game-border)] bg-[var(--game-surface)] px-6 py-3 text-sm font-semibold text-[var(--game-text)] transition-colors hover:border-[var(--game-accent)]"
        >
          {t('result_next')}
        </button>
      </div>
    </div>
  );
}
