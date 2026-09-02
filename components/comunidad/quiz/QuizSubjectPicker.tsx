'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useQuizSubjects } from '@/lib/hooks/useComunidad';
import { GameErrorState } from '../GameErrorState';
import type { QuizSubject } from '@/lib/comunidad/quiz';

/**
 * Lets the player pick a subject to start a quiz. Only subjects with at least
 * one active question are listed (Req. 1.1/1.5).
 */
export function QuizSubjectPicker({ onPick }: { onPick: (subject: QuizSubject) => void }) {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useQuizSubjects();

  const subjects = data?.subjects ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('quiz_pick_title')}</h2>
        <p className="text-sm text-[var(--game-text-muted)]">{t('quiz_pick_subtitle')}</p>
      </div>

      {isLoading ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-live="polite"
          aria-label={t('loading')}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
            />
          ))}
        </div>
      ) : isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : subjects.length === 0 ? (
        <Card
          padding="lg"
          className="flex flex-col items-center gap-2 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
        >
          <BookOpen className="size-8 text-[var(--game-text-muted)]" />
          <p className="text-sm text-[var(--game-text-muted)]">{t('quiz_no_subjects')}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s)}
              className="group flex items-center gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 text-left shadow-[var(--game-shadow)] transition-colors hover:bg-[var(--game-accent-muted)]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--game-text)]">{s.name}</div>
                <div className="text-xs text-[var(--game-text-muted)]">
                  {t('quiz_subject_count', { count: s.effective_question_count })}
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-[var(--game-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
