'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import {
  useAdminDailyQuestions,
  useCurateDailyQuestion,
  useAdminQuestions,
} from '@/lib/hooks/useComunidadAdmin';

/** Daily question curation (Req. 13): pick a question for a specific date. */
export function DailyQuestionTab() {
  const t = useTranslations('comunidadEstrategica');
  const today = new Date().toISOString().slice(0, 10);

  const { data: curated } = useAdminDailyQuestions();
  const curate = useCurateDailyQuestion();

  const [date, setDate] = useState(today);
  const [search, setSearch] = useState('');
  const { data: questions } = useAdminQuestions(search);

  const onCurate = async (questionId: string) => {
    try {
      await curate.mutateAsync({ question_date: date, question_id: questionId });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('daily_curate_title')}
        </h3>
        <label className="flex max-w-xs flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('daily_curate_date')}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('daily_curate_search')}
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('daily_curate_search_placeholder')}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>

        <div className="max-h-80 divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {(questions ?? []).length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('daily_curate_no_questions')}</p>
          ) : (
            (questions ?? []).map((q) => (
              <div key={q.id} className="flex items-center gap-3 p-3">
                <span className="line-clamp-2 flex-1 text-sm text-[var(--color-text-primary)]">
                  {q.content}
                </span>
                <Button size="sm" variant="secondary" onClick={() => onCurate(q.id)} loading={curate.isPending}>
                  {t('daily_curate_assign')}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('daily_recent_title')}
        </h3>
        {(curated ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('daily_recent_empty')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {(curated ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-[var(--color-text-primary)]">{c.question_date}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {c.is_manually_curated ? t('daily_manual') : t('daily_auto')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
