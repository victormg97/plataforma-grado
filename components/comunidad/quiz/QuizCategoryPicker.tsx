'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/common/Card';
import { useQuizCategories } from '@/lib/hooks/useComunidad';
import { QuizStepHeader } from './QuizStepHeader';
import { AllCategoriesTile, CategoryTile } from './QuizTiles';
import type { QuizCategory, QuizSubject } from '@/lib/comunidad/quiz';

/**
 * Category step within a subject: a featured "all categories" tile in the
 * subject's color, then one tile per visible category (admin order, icon and
 * color; categories without a color follow the subject's).
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
      <QuizStepHeader
        step={2}
        title={t('quiz_category_title')}
        subtitle={t('quiz_category_subtitle', { subject: subject.name })}
        onBack={onBack}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
          <span className="sr-only">{t('loading')}</span>
          <div className="col-span-full h-28 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" />
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
          <AllCategoriesTile
            subject={{
              name: subject.name,
              iconKey: subject.icon_key,
              imagePath: subject.icon_image_path,
              colorKey: subject.color_key,
            }}
            questionCount={subject.effective_question_count}
            onClick={() => onPick(null)}
          />

          {categories.map((c, i) => (
            <CategoryTile
              key={c.id}
              index={i}
              item={{
                name: c.name,
                description: c.description,
                iconKey: c.icon_key,
                imagePath: c.icon_image_path,
                colorKey: c.color_key,
              }}
              fallbackColorKey={subject.color_key}
              questionCount={c.active_question_count}
              playedCount={c.played_count ?? 0}
              onClick={() => onPick(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
