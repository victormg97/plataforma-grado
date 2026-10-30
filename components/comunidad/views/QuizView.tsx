'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, X } from 'lucide-react';
import { useGameProfile, useStartQuiz, useSubmitQuiz } from '@/lib/hooks/useComunidad';
import { useUserStore } from '@/stores/useUserStore';
import { Card } from '@/components/common/Card';
import { QuizSubjectPicker } from '../quiz/QuizSubjectPicker';
import { QuizCategoryPicker } from '../quiz/QuizCategoryPicker';
import { QuizRunner, type QuizProgress } from '../quiz/QuizRunner';
import { QuizResult } from '../quiz/QuizResult';
import {
  playerKey,
  readPlayerItem,
  removePlayerItem,
  writePlayerItem,
} from '@/lib/comunidad/player-storage';
import type {
  QuizAnswer,
  QuizCategory,
  QuizQuestion,
  QuizSubject,
  QuizSubmitResult,
} from '@/lib/comunidad/quiz';

type Stage = 'pick' | 'category' | 'run' | 'result';

/** Attempt snapshot saved per player so a reload / tab change loses nothing. */
interface SavedQuiz {
  stage: Exclude<Stage, 'pick'>;
  subject: QuizSubject | null;
  categoryId: string | null;
  /** Server-issued attempt id: re-submitting it never double-counts. */
  attemptId?: string | null;
  questions: QuizQuestion[];
  progress: QuizProgress | null;
  result: QuizSubmitResult | null;
}

const ATTEMPT_NAME = 'quiz-attempt';
// Questions are drawn at random per attempt; an old attempt is not worth
// resuming after this long.
const ATTEMPT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Orchestrates the quiz flow: subject picker -> (optional) category picker ->
 * runner -> result.
 *
 * The attempt (stage, questions, every answer, current question and the
 * result) is saved per player in localStorage on each change. Reloading the
 * page, switching game tabs or closing the browser resumes exactly where the
 * player left off, so there is no "you'll lose your progress" prompt anymore.
 */
export function QuizView() {
  const t = useTranslations('comunidadEstrategica');
  const userId = useUserStore((s) => s.user?.id ?? null);
  const storageKey = userId ? playerKey(userId, ATTEMPT_NAME) : null;

  const [restored, setRestored] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [stage, setStage] = useState<Stage>('pick');
  const [subject, setSubject] = useState<QuizSubject | null>(null);
  // Category of the running attempt; sent on submit so the point event keeps
  // its category (category challenges/badges rely on it).
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [initialProgress, setInitialProgress] = useState<QuizProgress | null>(null);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressRef = useRef<QuizProgress | null>(null);

  const { data: profile } = useGameProfile();
  const startQuiz = useStartQuiz();
  const submitQuiz = useSubmitQuiz();

  // Restore a saved attempt once (client only; storage isn't available SSR).
  useEffect(() => {
    if (restored || !storageKey) return;
    const saved = readPlayerItem<SavedQuiz>(storageKey, { maxAgeMs: ATTEMPT_MAX_AGE_MS });
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from storage */
    if (saved) {
      setStage(saved.stage);
      setSubject(saved.subject);
      setCategoryId(saved.categoryId);
      setAttemptId(saved.attemptId ?? null);
      setQuestions(saved.questions ?? []);
      setInitialProgress(saved.progress);
      progressRef.current = saved.progress;
      setResult(saved.result);
      setResumed(saved.stage === 'run');
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [restored, storageKey]);

  const persist = useCallback(
    (snapshot: SavedQuiz | null) => {
      if (!storageKey) return;
      if (snapshot) writePlayerItem(storageKey, snapshot);
      else removePlayerItem(storageKey);
    },
    [storageKey]
  );

  // Persist stage changes (pick = nothing to keep).
  useEffect(() => {
    if (!restored) return;
    if (stage === 'pick') {
      persist(null);
      return;
    }
    persist({ stage, subject, categoryId, attemptId, questions, progress: progressRef.current, result });
  }, [restored, stage, subject, categoryId, attemptId, questions, result, persist]);

  // Persist each answer while running (cheap: small JSON, sync write).
  const handleProgress = useCallback(
    (progress: QuizProgress) => {
      progressRef.current = progress;
      if (stage !== 'run') return;
      persist({ stage, subject, categoryId, attemptId, questions, progress, result: null });
    },
    [stage, subject, categoryId, attemptId, questions, persist]
  );

  const beginQuiz = async (subjectId: string, pickedCategoryId: string | null, picked: QuizSubject) => {
    setError(null);
    try {
      const res = await startQuiz.mutateAsync({ subject_id: subjectId, category_id: pickedCategoryId });
      if (!res.ok || !res.questions || res.questions.length === 0) {
        setError(res.error_code ?? 'NO_QUESTIONS');
        return;
      }
      progressRef.current = null;
      setInitialProgress(null);
      setResumed(false);
      setSubject(picked);
      setCategoryId(pickedCategoryId);
      setAttemptId(res.attempt_id ?? null);
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
      const res = await submitQuiz.mutateAsync({
        subject_id: subject.id,
        category_id: categoryId,
        attempt_id: attemptId,
        answers,
      });
      // The refreshed game state was already seeded into the cache; don't
      // keep it in the saved attempt.
      const { state: _state, ...clean } = res;
      setResult(clean);
      setResumed(false);
      setStage('result');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'ERROR');
    }
  };

  const resetToPick = () => {
    progressRef.current = null;
    setInitialProgress(null);
    setResumed(false);
    setStage('pick');
    setSubject(null);
    setCategoryId(null);
    setAttemptId(null);
    setQuestions([]);
    setResult(null);
    setError(null);
  };

  // Out of lives (and the tenant blocks play): say so up front instead of
  // letting the player pick a subject only to be rejected.
  const outOfLives =
    !!profile?.lives?.enabled &&
    profile.lives.block_when_empty &&
    (profile.lives.current ?? 0) <= 0;

  if (!restored && storageKey) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label={t('loading')}>
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (outOfLives && stage !== 'run' && stage !== 'result') {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('lives_none_message')}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stage === 'pick' && <QuizSubjectPicker onPick={handlePickSubject} />}
      {stage === 'category' && subject && (
        <QuizCategoryPicker subject={subject} onPick={handlePickCategory} onBack={resetToPick} />
      )}

      {stage === 'run' && resumed && (
        <div
          className="flex items-center gap-3 rounded-[var(--game-radius-sm)] border border-[var(--game-accent)]/30 bg-[var(--game-accent-muted)] px-4 py-3 text-sm text-[var(--game-text)]"
          role="status"
        >
          <History className="size-4 shrink-0 text-[var(--game-accent)]" />
          <span className="flex-1">
            {subject ? t('quiz_resumed_subject', { subject: subject.name }) : t('quiz_resumed')}
          </span>
          <button
            type="button"
            onClick={resetToPick}
            className="inline-flex items-center gap-1 rounded-[var(--game-radius-sm)] px-2 py-1 text-xs font-semibold text-[var(--game-accent)] transition-colors hover:bg-[var(--game-surface)]"
          >
            <X className="size-3.5" />
            {t('quiz_discard')}
          </button>
        </div>
      )}

      {stage === 'run' && (
        <QuizRunner
          questions={questions}
          submitting={submitQuiz.isPending}
          onFinish={handleFinish}
          initialProgress={initialProgress}
          onProgress={handleProgress}
        />
      )}
      {stage === 'result' && result && <QuizResult result={result} onRestart={resetToPick} />}

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
