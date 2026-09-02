'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Check, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useDailyReview, type DailyReviewResult } from '@/lib/hooks/useComunidad';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Read-only review of the daily question the player already answered today:
 * status (correct/incorrect), the question, their given answer, the correct
 * answer and the explanation. Resets naturally when the day's question changes.
 */
export function DailyReviewPanel() {
  const { data, isLoading } = useDailyReview();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8" role="status" aria-live="polite">
        <div className="size-6 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!data || !data.answered || !data.question) return null;

  return <ReviewBody data={data} />;
}

function ReviewBody({ data }: { data: DailyReviewResult }) {
  const t = useTranslations('comunidadEstrategica');
  const q = data.question!;
  const correct = !!data.is_correct;

  return (
    <div className="flex flex-col gap-4">
      {/* Status banner */}
      <div
        className={cn(
          'flex items-center justify-center gap-2 rounded-[var(--game-radius-sm)] px-4 py-3 text-center',
          correct ? 'bg-[var(--game-correct)]/12' : 'bg-[var(--game-incorrect)]/12'
        )}
        role="status"
      >
        {correct ? (
          <CheckCircle2 className="size-6 text-[var(--game-correct)]" />
        ) : (
          <XCircle className="size-6 text-[var(--game-incorrect)]" />
        )}
        <span
          className={cn(
            'text-base font-bold',
            correct ? 'text-[var(--game-correct)]' : 'text-[var(--game-incorrect)]'
          )}
        >
          {correct ? t('result_correct') : t('result_incorrect')}
        </span>
      </div>

      {/* Question */}
      <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
          {t('review_question_title')}
        </h3>
        <div
          className="prose prose-sm max-w-none font-medium text-[var(--game-text)]"
          dangerouslySetInnerHTML={{ __html: q.content }}
        />

        {q.type === 'true_false' ? (
          <TrueFalseReview data={data} />
        ) : (
          <ChoiceReview data={data} />
        )}
      </Card>

      {/* Explanation */}
      <Card padding="lg" className="flex flex-col gap-2 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
          {t('result_explanation_title')}
        </h3>
        {q.explanation ? (
          <div
            className="prose prose-sm max-w-none leading-relaxed text-[var(--game-text)] [&_em]:italic [&_li]:mb-1 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: q.explanation }}
          />
        ) : (
          <p className="text-sm text-[var(--game-text)]">{t('result_no_explanation')}</p>
        )}
      </Card>
    </div>
  );
}

/** Renders each choice option marking the correct one and the player's pick. */
function ChoiceReview({ data }: { data: DailyReviewResult }) {
  const t = useTranslations('comunidadEstrategica');
  const q = data.question!;
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = data.given_answer?.selected ?? null;

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, idx) => {
        const isCorrect = opt.is_correct;
        const isPicked = selected?.includes(idx) ?? false;
        return (
          <div
            key={idx}
            className={cn(
              'flex items-start gap-3 rounded-[var(--game-radius-sm)] border px-4 py-3 text-sm',
              isCorrect
                ? 'border-[var(--game-correct)] bg-[var(--game-correct)]/8'
                : isPicked
                  ? 'border-[var(--game-incorrect)] bg-[var(--game-incorrect)]/8'
                  : 'border-[var(--game-border)] bg-[var(--game-surface-muted)]'
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isCorrect
                  ? 'bg-[var(--game-correct)] text-white'
                  : isPicked
                    ? 'bg-[var(--game-incorrect)] text-white'
                    : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
              )}
            >
              {LETTERS[idx] ?? idx + 1}
            </span>
            <span className="flex-1 text-[var(--game-text)]">{opt.text}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {isPicked && (
                <span className="rounded-full bg-[var(--game-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--game-text-muted)]">
                  {t('review_your_answer')}
                </span>
              )}
              {isCorrect && <Check className="size-4 text-[var(--game-correct)]" />}
              {isPicked && !isCorrect && <X className="size-4 text-[var(--game-incorrect)]" />}
            </div>
          </div>
        );
      })}
      {selected === null && (
        <p className="text-xs text-[var(--game-text-muted)]">{t('review_answer_unavailable')}</p>
      )}
    </div>
  );
}

/** Renders true/false review with the correct value and the player's pick. */
function TrueFalseReview({ data }: { data: DailyReviewResult }) {
  const t = useTranslations('comunidadEstrategica');
  const q = data.question!;
  const correctValue =
    !Array.isArray(q.options) && typeof q.options.correct_answer === 'boolean'
      ? q.options.correct_answer
      : null;
  const givenValue =
    typeof data.given_answer?.value === 'boolean' ? data.given_answer.value : null;

  const rows: { label: string; value: boolean }[] = [
    { label: t('daily_true'), value: true },
    { label: t('daily_false'), value: false },
  ];

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const isCorrect = correctValue === row.value;
        const isPicked = givenValue === row.value;
        return (
          <div
            key={String(row.value)}
            className={cn(
              'flex items-center gap-3 rounded-[var(--game-radius-sm)] border px-4 py-3 text-sm',
              isCorrect
                ? 'border-[var(--game-correct)] bg-[var(--game-correct)]/8'
                : isPicked
                  ? 'border-[var(--game-incorrect)] bg-[var(--game-incorrect)]/8'
                  : 'border-[var(--game-border)] bg-[var(--game-surface-muted)]'
            )}
          >
            <span className="flex-1 text-[var(--game-text)]">{row.label}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {isPicked && (
                <span className="rounded-full bg-[var(--game-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--game-text-muted)]">
                  {t('review_your_answer')}
                </span>
              )}
              {isCorrect && <Check className="size-4 text-[var(--game-correct)]" />}
              {isPicked && !isCorrect && <X className="size-4 text-[var(--game-incorrect)]" />}
            </div>
          </div>
        );
      })}
      {givenValue === null && (
        <p className="text-xs text-[var(--game-text-muted)]">{t('review_answer_unavailable')}</p>
      )}
    </div>
  );
}
