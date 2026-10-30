'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Star, Sparkles, MessageSquare, Award } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import type { WeeklyCaseMyAnswer } from '@/lib/comunidad/weekly-case';

/**
 * Grade of the player's weekly-case answer (after an admin review): a gold
 * seal with the stars popping in one by one, the XP earned and the reviewer's
 * written feedback.
 */
export function CaseGradeFeedback({ myAnswer }: { myAnswer: WeeklyCaseMyAnswer }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();

  if (!myAnswer.graded) return null;

  const score = myAnswer.quality_score ?? null;
  const points = myAnswer.points_awarded ?? 0;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--game-radius-sm)] border border-[var(--game-rank-gold)]/50 bg-[var(--game-surface)] p-4 shadow-[0_10px_24px_-18px_var(--game-rank-gold)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,var(--game-rank-gold-light),var(--game-rank-gold),var(--game-rank-gold-dark),var(--game-rank-gold-light))] text-[var(--game-rank-gold-dark)] shadow-sm">
          <Award className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-[var(--game-text)]">{t('weekly_case_grade_title')}</h4>
          {score !== null && (
            <div className="mt-0.5 flex items-center gap-0.5" aria-label={t('weekly_case_grade_quality')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <m.span
                  key={n}
                  initial={reduceMotion ? false : { scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: reduceMotion ? 0 : 0.1 + n * 0.08 }}
                >
                  <Star
                    className={`size-5 ${
                      score >= n
                        ? 'fill-[var(--game-rank-gold)] text-[var(--game-rank-gold)]'
                        : 'text-[var(--game-text-muted)]/50'
                    }`}
                  />
                </m.span>
              ))}
            </div>
          )}
        </div>
        {points > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--game-rank-gold-bg)] px-3 py-1 text-sm font-black text-[var(--game-rank-gold-dark)]">
            <Sparkles className="size-4" />+{points} {t('result_points')}
          </span>
        )}
      </div>

      {myAnswer.feedback && (
        <div className="flex gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-surface-muted)] p-3">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-[var(--game-text-muted)]" />
          <RichDescription html={myAnswer.feedback} className="text-[var(--game-text)]" />
        </div>
      )}
    </section>
  );
}
