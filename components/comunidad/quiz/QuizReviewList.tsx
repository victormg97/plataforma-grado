'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GameRichText } from '../GameRichText';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestionReview } from '@/lib/comunidad/quiz';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

type Filter = 'all' | 'wrong';

/** Plain-text preview of the question HTML (for the collapsed row). */
function preview(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Per-question review shown after a quiz: what the player answered, the
 * correct solution and the explanation, for every question type. Wrong ones
 * can be filtered; the first wrong answer starts expanded.
 */
export function QuizReviewList({ details }: { details: QuizQuestionReview[] }) {
  const t = useTranslations('comunidadEstrategica');
  const wrongCount = details.filter((d) => !d.is_correct).length;
  const [filter, setFilter] = useState<Filter>(wrongCount > 0 ? 'wrong' : 'all');
  const [open, setOpen] = useState<Set<string>>(() => {
    const firstWrong = details.find((d) => !d.is_correct);
    return new Set(firstWrong ? [firstWrong.question_id] : []);
  });

  const visible = useMemo(
    () =>
      details
        .map((d, i) => ({ d, n: i + 1 }))
        .filter(({ d }) => filter === 'all' || !d.is_correct),
    [details, filter]
  );

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="quiz-review-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="quiz-review-title" className="text-lg font-bold text-[var(--game-text)]">
          {t('quiz_review_title')}
        </h3>
        <div className="flex gap-1 rounded-full bg-[var(--game-surface-muted)] p-1" role="tablist">
          {(['wrong', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filter === f
                  ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
                  : 'text-[var(--game-text-muted)] hover:text-[var(--game-text)]'
              )}
            >
              {f === 'wrong'
                ? t('quiz_review_filter_wrong', { count: wrongCount })
                : t('quiz_review_filter_all', { count: details.length })}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--game-radius-sm)] bg-[var(--game-correct)]/10 px-4 py-3 text-sm font-medium text-[var(--game-correct)]">
          {t('quiz_review_all_correct')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ d, n }) => (
            <ReviewItem
              key={d.question_id}
              n={n}
              review={d}
              open={open.has(d.question_id)}
              onToggle={() => toggle(d.question_id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewItem({
  n,
  review,
  open,
  onToggle,
}: {
  n: number;
  review: QuizQuestionReview;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const ok = review.is_correct;
  const panelId = `quiz-review-${review.question_id}`;

  return (
    <li
      className={cn(
        'overflow-hidden rounded-[var(--game-radius-sm)] border bg-[var(--game-surface)] shadow-[var(--game-shadow)]',
        ok ? 'border-[var(--game-correct)]/35' : 'border-[var(--game-incorrect)]/35'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {ok ? (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--game-correct)]" aria-label={t('quiz_review_correct')} />
        ) : (
          <XCircle className="size-5 shrink-0 text-[var(--game-incorrect)]" aria-label={t('quiz_review_incorrect')} />
        )}
        <span className="shrink-0 text-xs font-bold text-[var(--game-text-muted)]">#{n}</span>
        <span className="line-clamp-1 flex-1 text-sm text-[var(--game-text)]">{preview(review.content)}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-[var(--game-text-muted)] transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            key="panel"
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex flex-col gap-4 border-t border-[var(--game-border)] px-4 py-4">
              <GameRichText html={review.content} variant="question" />
              <AnswerReview review={review} />
              <div className="flex flex-col gap-1.5 rounded-[var(--game-radius-sm)] bg-[var(--game-surface-muted)] px-3 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
                  {t('result_explanation_title')}
                </span>
                {review.explanation ? (
                  <GameRichText html={review.explanation} variant="body" />
                ) : (
                  <p className="text-sm text-[var(--game-text)]">{t('result_no_explanation')}</p>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Shared row look: green = correct, red = player's wrong pick, neutral otherwise. */
function Row({
  tone,
  badge,
  picked,
  children,
}: {
  tone: 'correct' | 'wrong' | 'neutral';
  badge?: React.ReactNode;
  picked?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('comunidadEstrategica');
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[var(--game-radius-sm)] border px-3 py-2.5 text-sm',
        tone === 'correct'
          ? 'border-[var(--game-correct)] bg-[var(--game-correct)]/8'
          : tone === 'wrong'
            ? 'border-[var(--game-incorrect)] bg-[var(--game-incorrect)]/8'
            : 'border-[var(--game-border)] bg-[var(--game-surface-muted)]'
      )}
    >
      {badge}
      <div className="flex-1 text-[var(--game-text)]">{children}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        {picked && (
          <span className="rounded-full bg-[var(--game-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--game-text-muted)]">
            {t('review_your_answer')}
          </span>
        )}
        {tone === 'correct' && <Check className="size-4 text-[var(--game-correct)]" />}
        {tone === 'wrong' && <X className="size-4 text-[var(--game-incorrect)]" />}
      </div>
    </div>
  );
}

function AnswerReview({ review }: { review: QuizQuestionReview }) {
  const t = useTranslations('comunidadEstrategica');
  const { solution, answer } = review;

  if (review.type === 'single_choice' || review.type === 'multiple_choice') {
    const options = Array.isArray(solution) ? solution : [];
    const selected = answer.selected ?? [];
    return (
      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => {
          const picked = selected.includes(idx);
          return (
            <Row
              key={idx}
              tone={opt.is_correct ? 'correct' : picked ? 'wrong' : 'neutral'}
              picked={picked}
              badge={
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[11px] font-bold text-[var(--game-accent)]">
                  {LETTERS[idx] ?? idx + 1}
                </span>
              }
            >
              {opt.text}
            </Row>
          );
        })}
      </div>
    );
  }

  if (review.type === 'true_false') {
    const correct =
      solution && !Array.isArray(solution) && 'correct_answer' in solution ? solution.correct_answer : null;
    return (
      <div className="flex flex-col gap-2">
        {[true, false].map((value) => {
          const picked = answer.value === value;
          return (
            <Row
              key={String(value)}
              tone={correct === value ? 'correct' : picked ? 'wrong' : 'neutral'}
              picked={picked}
            >
              {value ? t('quiz_true') : t('quiz_false')}
            </Row>
          );
        })}
      </div>
    );
  }

  if (review.type === 'matching') {
    const pairs = solution && !Array.isArray(solution) && 'pairs' in solution ? solution.pairs : [];
    const matches = answer.matches ?? [];
    return (
      <div className="flex flex-col gap-2">
        {pairs.map((pair, i) => {
          const givenKey = matches[i];
          const given = givenKey !== undefined && givenKey >= 0 ? pairs[givenKey]?.right : undefined;
          const ok = givenKey === i;
          return (
            <Row key={i} tone={ok ? 'correct' : 'wrong'}>
              <div className="font-semibold">{pair.left}</div>
              <div className="mt-0.5 text-xs">
                <span className="text-[var(--game-text-muted)]">{t('review_your_answer')}: </span>
                {given ?? <em className="text-[var(--game-text-muted)]">{t('quiz_review_no_answer')}</em>}
              </div>
              {!ok && (
                <div className="mt-0.5 text-xs text-[var(--game-correct)]">
                  {t('quiz_review_correct_answer')}: {pair.right}
                </div>
              )}
            </Row>
          );
        })}
      </div>
    );
  }

  if (review.type === 'fill_blank') {
    const accepted = solution && !Array.isArray(solution) && 'blanks' in solution ? solution.blanks : [];
    const given = answer.blanks ?? [];
    return (
      <div className="flex flex-col gap-2">
        {accepted.map((options, i) => {
          const value = (given[i] ?? '').trim();
          const ok = value !== '' && options.some((a) => a.trim().toLowerCase() === value.toLowerCase());
          const [main, ...others] = options;
          return (
            <Row key={i} tone={ok ? 'correct' : 'wrong'}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
                {t('quiz_review_blank', { n: i + 1 })}
              </div>
              <div className="mt-0.5">
                <span className="text-xs text-[var(--game-text-muted)]">{t('review_your_answer')}: </span>
                {value || <em className="text-[var(--game-text-muted)]">{t('quiz_review_no_answer')}</em>}
              </div>
              {!ok && main && (
                <div className="mt-0.5 text-xs text-[var(--game-correct)]">
                  {t('quiz_review_correct_answer')}: {main}
                </div>
              )}
              {others.length > 0 && (
                <div className="mt-0.5 text-xs text-[var(--game-text-muted)]">
                  {t('quiz_review_also_valid', { answers: others.join(', ') })}
                </div>
              )}
            </Row>
          );
        })}
      </div>
    );
  }

  return null;
}
