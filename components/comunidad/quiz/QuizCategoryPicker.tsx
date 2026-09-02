'use client';

import { useTranslations } from 'next-intl';
import { Layers, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useQuizCategories } from '@/lib/hooks/useComunidad';
import type { QuizCategory, QuizSubject } from '@/lib/comunidad/quiz';

/**
 * Optional category step within a subject. Lists only categories with active
 * questions (from DB, per tenant). Offers an "all categories" option that
 * starts the quiz across the whole subject. If the subject has no categorized
 * active questions, the parent skips straight to the quiz.
 */
export function QuizCategoryPicker({
  subject,
  onPick,
  onBack,
}: {
  subject: QuizSubject;
  onPick: (category: QuizCategory | null) => void;
  onBack: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError } = useQuizCategories(subject.id);

  const categories = data?.categories ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-[var(--game-radius-sm)] px-2 py-1 text-sm text-[var(--game-text-muted)] transition-colors hover:text-[var(--game-text)]"
        >
          <ArrowLeft className="size-4" />
          {t('quiz_back_to_subjects')}
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-[var(--game-text)]">{t('quiz_category_title')}</h2>
        <p className="text-sm text-[var(--game-text-muted)]">
          {t('quiz_category_subtitle', { subject: subject.name })}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
          <span className="sr-only">{t('loading')}</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
            />
          ))}
        </div>
      ) : isError ? (
        <Card
          padding="lg"
          className="flex flex-col items-center gap-2 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
        >
          <p className="text-sm text-[var(--game-incorrect)]">{t('error_loading')}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* All categories option — starts the quiz across the whole subject. */}
          <button
            type="button"
            onClick={() => onPick(null)}
            className="group flex items-center gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 text-left shadow-[var(--game-shadow)] transition-colors hover:bg-[var(--game-accent-muted)]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
              <Layers className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[var(--game-text)]">{t('quiz_category_all')}</div>
              <div className="text-xs text-[var(--game-text-muted)]">{t('quiz_category_all_hint')}</div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-[var(--game-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="group flex items-center gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 text-left shadow-[var(--game-shadow)] transition-colors hover:bg-[var(--game-accent-muted)]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
                <Layers className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--game-text)]">{c.name}</div>
                <div className="text-xs text-[var(--game-text-muted)]">
                  {t('quiz_subject_count', { count: c.active_question_count })}
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
