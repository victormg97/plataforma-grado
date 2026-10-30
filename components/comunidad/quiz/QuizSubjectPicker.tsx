'use client';

import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useQuizSubjects } from '@/lib/hooks/useComunidad';
import { GameErrorState } from '../GameErrorState';
import { QuizStepHeader } from './QuizStepHeader';
import { SubjectTile } from './QuizTiles';
import type { QuizSubject } from '@/lib/comunidad/quiz';

/**
 * "Level select" for quizzes: one colored tile per subject with its icon,
 * description, question/category counts and how many times the player has
 * played it. Only visible subjects with playable questions are listed, in the
 * admin's order (Cuestionarios config tab).
 */
export function QuizSubjectPicker({ onPick }: { onPick: (subject: QuizSubject) => void }) {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useQuizSubjects();

  const subjects = data?.subjects ?? [];

  return (
    <div className="flex flex-col gap-4">
      <QuizStepHeader step={1} title={t('quiz_pick_title')} subtitle={t('quiz_pick_subtitle')} />

      {isLoading ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-live="polite"
          aria-label={t('loading')}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s, i) => (
            <SubjectTile
              key={s.id}
              index={i}
              item={{
                name: s.name,
                description: s.description,
                iconKey: s.icon_key,
                imagePath: s.icon_image_path,
                colorKey: s.color_key,
              }}
              questionCount={s.effective_question_count}
              categoryCount={s.category_count ?? 0}
              playedCount={s.played_count ?? 0}
              onClick={() => onPick(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
