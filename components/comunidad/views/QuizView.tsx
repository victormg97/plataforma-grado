'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useStartQuiz, useSubmitQuiz } from '@/lib/hooks/useComunidad';
import { QuizSubjectPicker } from '../quiz/QuizSubjectPicker';
import { QuizCategoryPicker } from '../quiz/QuizCategoryPicker';
import { QuizRunner } from '../quiz/QuizRunner';
import { QuizResult } from '../quiz/QuizResult';
import { useGameNavGuard, useUnsavedChangesBlocker } from '../GameNavGuard';
import type {
  QuizAnswer,
  QuizCategory,
  QuizQuestion,
  QuizSubject,
  QuizSubmitResult,
} from '@/lib/comunidad/quiz';

type Stage = 'pick' | 'category' | 'run' | 'result';

/**
 * Orchestrates the quiz flow: subject picker -> (optional) category picker ->
 * runner -> result. The internal stage is local state. While a quiz is in
 * progress ('run'), an unsaved-changes blocker prompts before leaving the view
 * or restarting, and a native beforeunload guards reload/tab-close.
 */
export function QuizView() {
  const t = useTranslations('comunidadEstrategica');
  const [stage, setStage] = useState<Stage>('pick');
  const [subject, setSubject] = useState<QuizSubject | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useStartQuiz();
  const submitQuiz = useSubmitQuiz();
  const { guardedRun } = useGameNavGuard();

  // Block navigation while a quiz is in progress (Req: avoid accidental loss).
  useUnsavedChangesBlocker(stage === 'run', t('quiz_leave_message'));

  const beginQuiz = async (subjectId: string, categoryId: string | null, picked: QuizSubject) => {
    setError(null);
    try {
      const res = await startQuiz.mutateAsync({ subject_id: subjectId, category_id: categoryId });
      if (!res.ok || !res.questions || res.questions.length === 0) {
        setError(res.error_code ?? 'NO_QUESTIONS');
        return;
      }
      setSubject(picked);
      setQuestions(res.questions);
      setStage('run');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'ERROR');
    }
  };

  const handlePickSubject = (picked: QuizSubject) => {
    setSubject(picked);
    setStage('category');
  };

  const handlePickCategory = (category: QuizCategory | null) => {
    if (!subject) return;
    void beginQuiz(subject.id, category?.id ?? null, subject);
  };

  const handleFinish = async (answers: QuizAnswer[]) => {
    if (!subject) return;
    setError(null);
    try {
      const res = await submitQuiz.mutateAsync({ subject_id: subject.id, answers });
      setResult(res);
      setStage('result');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'ERROR');
    }
  };

  const resetToPick = () => {
    setStage('pick');
    setSubject(null);
    setQuestions([]);
    setResult(null);
    setError(null);
  };

  // From the result screen there's nothing to lose; from 'run' the blocker
  // (via guardedRun) will prompt before discarding the attempt.
  const handleRestart = () => guardedRun(resetToPick);

  return (
    <div className="flex flex-col gap-4">
      {stage === 'pick' && <QuizSubjectPicker onPick={handlePickSubject} />}
      {stage === 'category' && subject && (
        <QuizCategoryPicker
          subject={subject}
          onPick={handlePickCategory}
          onBack={resetToPick}
        />
      )}
      {stage === 'run' && (
        <QuizRunner questions={questions} submitting={submitQuiz.isPending} onFinish={handleFinish} />
      )}
      {stage === 'result' && result && <QuizResult result={result} onRestart={handleRestart} />}

      {error && (
        <p className="text-sm text-[var(--game-incorrect)]" role="alert">
          {error === 'NO_QUESTIONS'
            ? t('quiz_no_questions')
            : error === 'NO_LIVES'
              ? t('lives_none_message')
              : error === 'PLAYER_BANNED'
                ? t('banned_short')
                : t('quiz_error')}
        </p>
      )}
    </div>
  );
}
