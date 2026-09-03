'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import type { QuizAnswer, QuizQuestion, QuizQuestionOption } from '@/lib/comunidad/quiz';
import { QuizMatching } from './QuizMatching';
import { QuizFillBlank } from './QuizFillBlank';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Runs the quiz across every question type (single/multiple choice, true/false,
 * matching, fill_blank). Collects the player's answer per question and calls
 * onFinish with the typed payload. Correctness is evaluated server-side on
 * submit; nothing here reveals the solution.
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
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  // Per-type answer state, keyed by question id.
  const [choices, setChoices] = useState<Record<string, number[]>>({});
  const [tfValues, setTfValues] = useState<Record<string, boolean>>({});
  const [matches, setMatches] = useState<Record<string, Record<number, number>>>({});
  const [blanks, setBlanks] = useState<Record<string, string[]>>({});

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
    switch (question.type) {
      case 'true_false':
        return tfValues[question.id] !== undefined;
      case 'matching': {
        const total = question.pairs_left?.length ?? 0;
        return Object.keys(matches[question.id] ?? {}).length === total && total > 0;
      }
      case 'fill_blank': {
        const total = question.blank_count ?? 0;
        const vals = blanks[question.id] ?? [];
        return total > 0 && vals.length >= total && vals.slice(0, total).every((v) => v.trim() !== '');
      }
      default:
        return (choices[question.id]?.length ?? 0) > 0;
    }
  };

  // Build the typed payload for every presented question (unanswered → empty),
  // so the server scores over the total presented.
  const buildAnswers = (): QuizAnswer[] =>
    questions.map((question) => {
      switch (question.type) {
        case 'true_false':
          return { question_id: question.id, value: tfValues[question.id] ?? false };
        case 'matching': {
          const map = matches[question.id] ?? {};
          const total = question.pairs_left?.length ?? 0;
          // matches[i] = assigned right key, or -1 when unset (counts as wrong).
          const arr = Array.from({ length: total }, (_, i) => (map[i] ?? -1));
          return { question_id: question.id, matches: arr };
        }
        case 'fill_blank': {
          const total = question.blank_count ?? 0;
          const vals = blanks[question.id] ?? [];
          return {
            question_id: question.id,
            blanks: Array.from({ length: total }, (_, i) => vals[i] ?? ''),
          };
        }
        default:
          return { question_id: question.id, selected: choices[question.id] ?? [] };
      }
    });

  const unansweredCount = questions.filter((question) => !hasAnswer(question)).length;
  const allAnswered = unansweredCount === 0;

  if (!q) return null;

  const options = Array.isArray(q.options) ? (q.options as QuizQuestionOption[]) : [];

  const renderBody = () => {
    if (q.type === 'true_false') {
      return (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('quiz_options_label')}>
          {[true, false].map((val) => {
            const selected = tfValues[q.id] === val;
            return (
              <OptionButton
                key={String(val)}
                selected={selected}
                role="radio"
                letter={val ? 'V' : 'F'}
                onClick={() => setTfValues((prev) => ({ ...prev, [q.id]: val }))}
              >
                {val ? t('quiz_true') : t('quiz_false')}
              </OptionButton>
            );
          })}
        </div>
      );
    }

    if (q.type === 'matching') {
      return (
        <QuizMatching
          left={q.pairs_left ?? []}
          right={q.pairs_right ?? []}
          value={matches[q.id] ?? {}}
          onChange={(next) => setMatches((prev) => ({ ...prev, [q.id]: next }))}
        />
      );
    }

    if (q.type === 'fill_blank') {
      return (
        <QuizFillBlank
          count={q.blank_count ?? 0}
          values={blanks[q.id] ?? []}
          onChange={(next) => setBlanks((prev) => ({ ...prev, [q.id]: next }))}
        />
      );
    }

    // single_choice / multiple_choice
    const multiple = q.type === 'multiple_choice';
    return (
      <div
        className="flex flex-col gap-2"
        role={multiple ? 'group' : 'radiogroup'}
        aria-label={t('quiz_options_label')}
      >
        {multiple && <p className="text-xs text-[var(--game-text-muted)]">{t('daily_multi_hint')}</p>}
        {options.map((opt, optIndex) => {
          const selected = (choices[q.id] ?? []).includes(optIndex);
          return (
            <OptionButton
              key={optIndex}
              selected={selected}
              role={multiple ? 'checkbox' : 'radio'}
              letter={LETTERS[optIndex] ?? String(optIndex + 1)}
              onClick={() => toggleChoice(q.id, optIndex, multiple)}
            >
              {opt.text}
            </OptionButton>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-[var(--game-text-muted)]">
        <span>{t('quiz_progress', { current: index + 1, total: questions.length })}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={q.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
            <div
              className="prose prose-sm max-w-none font-medium text-[var(--game-text)]"
              dangerouslySetInnerHTML={{ __html: q.content }}
            />
            {renderBody()}
          </Card>
        </m.div>
      </AnimatePresence>

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

/** Shared option button (choice + true/false) with a letter badge + animation. */
function OptionButton({
  selected,
  letter,
  role,
  onClick,
  children,
}: {
  selected: boolean;
  letter: string;
  role: 'radio' | 'checkbox';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <m.button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={cn(
        'flex items-center gap-3 rounded-[var(--game-radius-sm)] border px-4 py-3 text-left text-sm transition-colors',
        selected
          ? 'border-[var(--game-accent)] bg-[var(--game-option-selected-bg)] text-[var(--game-text)]'
          : 'border-[var(--game-border)] bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)]'
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
          selected
            ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
            : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
        )}
      >
        {selected ? <Check className="size-4" /> : letter}
      </span>
      <span className="flex-1">{children}</span>
    </m.button>
  );
}
