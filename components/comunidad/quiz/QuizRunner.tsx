'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/common/Card';
import type { QuizAnswer, QuizQuestion, QuizQuestionOption } from '@/lib/comunidad/quiz';

/**
 * Runs the quiz: renders each question, collects the player's selection, and
 * calls onFinish with the answers payload. Correctness is evaluated server-side
 * on submit; nothing here reveals the correct option (Req. 2).
 */
export function QuizRunner({
  questions,
  submitting,
  onFinish,
}: {
  questions: QuizQuestion[];
  submitting: boolean;
  onFinish: (answers: QuizAnswer[]) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const [index, setIndex] = useState(0);
  // Map question_id -> selection state.
  const [choices, setChoices] = useState<Record<string, number[]>>({});
  const [tfValues, setTfValues] = useState<Record<string, boolean>>({});

  const q = questions[index];
  const isLast = index === questions.length - 1;

  const toggleChoice = (qid: string, optIndex: number, multiple: boolean) => {
    setChoices((prev) => {
      const current = prev[qid] ?? [];
      if (multiple) {
        return {
          ...prev,
          [qid]: current.includes(optIndex)
            ? current.filter((i) => i !== optIndex)
            : [...current, optIndex],
        };
      }
      return { ...prev, [qid]: [optIndex] };
    });
  };

  const hasAnswer = (question: QuizQuestion): boolean => {
    if (question.type === 'true_false') return tfValues[question.id] !== undefined;
    return (choices[question.id]?.length ?? 0) > 0;
  };

  // Send every presented question (unanswered ones as empty), so the server
  // scores over the total presented, not only the answered subset.
  const buildAnswers = (): QuizAnswer[] =>
    questions.map((question) =>
      question.type === 'true_false'
        ? { question_id: question.id, value: tfValues[question.id] ?? false }
        : { question_id: question.id, selected: choices[question.id] ?? [] }
    );

  const unansweredCount = questions.filter((question) => !hasAnswer(question)).length;
  const allAnswered = unansweredCount === 0;

  if (!q) return null;

  const options = Array.isArray(q.options) ? (q.options as QuizQuestionOption[]) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-[var(--game-text-muted)]">
        <span>{t('quiz_progress', { current: index + 1, total: questions.length })}</span>
      </div>

      <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <div
          className="prose prose-sm max-w-none text-[var(--game-text)]"
          dangerouslySetInnerHTML={{ __html: q.content }}
        />

        <div
          className="flex flex-col gap-2"
          role={q.type === 'multiple_choice' ? 'group' : 'radiogroup'}
          aria-label={t('quiz_options_label')}
        >
          {q.type === 'true_false' ? (
            [true, false].map((val) => {
              const selected = tfValues[q.id] === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTfValues((prev) => ({ ...prev, [q.id]: val }))}
                  className={`rounded-[var(--game-radius)] border px-4 py-3 text-left text-sm transition-colors ${
                    selected
                      ? 'border-[var(--game-accent)] bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                      : 'border-[var(--game-border,transparent)] bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)]'
                  }`}
                >
                  {val ? t('quiz_true') : t('quiz_false')}
                </button>
              );
            })
          ) : (
            options.map((opt, optIndex) => {
              const multiple = q.type === 'multiple_choice';
              const selected = (choices[q.id] ?? []).includes(optIndex);
              return (
                <button
                  key={optIndex}
                  type="button"
                  role={multiple ? 'checkbox' : 'radio'}
                  aria-checked={selected}
                  onClick={() => toggleChoice(q.id, optIndex, multiple)}
                  className={`rounded-[var(--game-radius)] border px-4 py-3 text-left text-sm transition-colors ${
                    selected
                      ? 'border-[var(--game-accent)] bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                      : 'border-[var(--game-border,transparent)] bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)]'
                  }`}
                >
                  {opt.text}
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] px-4 py-2 text-sm font-medium text-[var(--game-text-muted)] transition-colors hover:text-[var(--game-text)] disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          {t('quiz_prev')}
        </button>

        {isLast ? (
          <div className="flex flex-col items-end gap-1">
            {!allAnswered && (
              <span className="text-xs text-[var(--game-text-muted)]" role="status">
                {t('quiz_unanswered', { count: unansweredCount })}
              </span>
            )}
            <button
              type="button"
              onClick={() => onFinish(buildAnswers())}
              disabled={submitting || !allAnswered}
              className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:opacity-60"
            >
              {submitting ? t('quiz_submitting') : t('quiz_finish')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={!hasAnswer(q)}
            className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:opacity-40"
          >
            {t('quiz_next')}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
