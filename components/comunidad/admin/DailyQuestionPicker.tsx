'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Search, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { AppSelect } from '@/components/common/AppSelect';
import { RichDescription } from '@/components/common/RichDescription';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  useQuestionPicker,
  useCurateDailyQuestion,
  useQbSubjects,
  useQbCategories,
  type PickerQuestion,
} from '@/lib/hooks/useComunidadAdmin';

const PAGE_SIZE = 8;

// Question types that can be a daily question (open_ended has no auto-grade,
// but is still assignable as a daily question if the admin wants). We simply
// expose all types as filters.
const QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'matching',
  'fill_blank',
  'open_ended',
] as const;

/**
 * Step 2 of the Daily Question tab: pick a question to assign to a date.
 *
 * Efficient by design: server-side pagination + filters via get_qb_questions
 * (one page at a time, keeps previous page while loading), debounced search,
 * and a double-confirm assign modal that lets the admin re-check (or change)
 * the target date before committing. Uses an optimistic cache update on assign.
 */
export function DailyQuestionPicker({
  date,
  onDateChange,
  assignedQuestionId,
  today,
}: {
  /** The date chosen in step 1 (YYYY-MM-DD). */
  date: string;
  /** Allow the confirm modal to change the target date. */
  onDateChange: (date: string) => void;
  /** Currently assigned question id for `date`, to mark it in the list. */
  assignedQuestionId?: string | null;
  today: string;
}) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : esLocale;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Confirm-assign modal state.
  const [confirmQ, setConfirmQ] = useState<PickerQuestion | null>(null);
  const [confirmDate, setConfirmDate] = useState(date);

  const { data: subjects } = useQbSubjects();
  const { data: categories } = useQbCategories();
  const curate = useCurateDailyQuestion();

  // Reset to page 1 whenever a filter changes.
  const filters = useMemo(
    () => ({ q: debouncedSearch, subjectId, categoryId, type, page, pageSize: PAGE_SIZE }),
    [debouncedSearch, subjectId, categoryId, type, page]
  );
  const { data, isLoading, isError, isFetching, refetch } = useQuestionPicker(filters);

  const resetToFirstPage = () => setPage(1);

  const items = data?.data ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const formatDate = (iso: string) => {
    try {
      return format(parseISO(iso), 'PPP', { locale: dateLocale });
    } catch {
      return iso;
    }
  };

  const openConfirm = (q: PickerQuestion) => {
    setConfirmDate(date);
    setConfirmQ(q);
  };

  const doAssign = async () => {
    if (!confirmQ) return;
    try {
      await curate.mutateAsync({ question_date: confirmDate, question_id: confirmQ.id });
      // Reflect a possible date change back to step 1.
      if (confirmDate !== date) onDateChange(confirmDate);
      toast.success(t('daily_assign_success'));
      setConfirmQ(null);
    } catch (e) {
      const code = (e as { message?: string })?.message;
      toast.error(code === 'QUESTION_NOT_FOUND' ? t('picker_error_not_found') : t('admin_error'));
    }
  };

  const typeLabel = (tp: string) => {
    const known = new Set(QUESTION_TYPES as readonly string[]);
    return known.has(tp) ? t(`picker_type_${tp}`) : tp;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetToFirstPage();
            }}
            placeholder={t('daily_curate_search_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-10 pr-3 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <AppSelect
            value={subjectId ?? ''}
            onChange={(v) => {
              setSubjectId(v || null);
              resetToFirstPage();
            }}
            options={[
              { value: '', label: t('picker_all_subjects') },
              ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <AppSelect
            value={categoryId ?? ''}
            onChange={(v) => {
              setCategoryId(v || null);
              resetToFirstPage();
            }}
            options={[
              { value: '', label: t('picker_all_categories') },
              ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <AppSelect
            value={type ?? ''}
            onChange={(v) => {
              setType(v || null);
              resetToFirstPage();
            }}
            options={[
              { value: '', label: t('picker_all_types') },
              ...QUESTION_TYPES.map((tp) => ({ value: tp, label: typeLabel(tp) })),
            ]}
          />
        </div>
      </div>

      {/* Results */}
      {isError ? (
        <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
          <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
          <Button variant="secondary" onClick={() => refetch()}>{t('error_retry')}</Button>
        </Card>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t('admin_loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t('daily_curate_no_questions')}</p>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {items.map((q) => {
            const isAssigned = assignedQuestionId === q.id;
            return (
              <div
                key={q.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {q.subject_name && (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                        {q.subject_name}
                      </span>
                    )}
                    {q.category_name && (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {q.category_name}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      {typeLabel(q.type)}
                    </span>
                  </div>
                  <RichDescription html={q.content} className="text-[var(--color-text-primary)]" />
                </div>
                <Button
                  size="sm"
                  variant={isAssigned ? 'ghost' : 'secondary'}
                  icon={isAssigned ? <Check className="size-4" /> : undefined}
                  disabled={isAssigned}
                  onClick={() => openConfirm(q)}
                  className="shrink-0"
                >
                  {isAssigned ? t('daily_assigned_short') : t('daily_curate_assign')}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('picker_page_of', { page, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<ChevronLeft className="size-4" />}
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('picker_prev')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('picker_next')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm-assign modal (double confirmation + optional date change) */}
      <Modal
        open={confirmQ !== null}
        onClose={() => setConfirmQ(null)}
        title={t('picker_confirm_title')}
        description={t('picker_confirm_desc')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmQ(null)}>
              {t('admin_cancel')}
            </Button>
            <Button onClick={doAssign} loading={curate.isPending}>
              {t('picker_confirm_assign', { date: formatDate(confirmDate) })}
            </Button>
          </>
        }
      >
        {confirmQ && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              {confirmQ.subject_name && (
                <span className="mb-1 inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                  {confirmQ.subject_name}
                </span>
              )}
              <RichDescription html={confirmQ.content} className="text-[var(--color-text-primary)]" />
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('picker_confirm_date_label')}
              </span>
              <input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
              />
              {confirmDate === today && (
                <span className="text-xs text-[var(--color-brand-gold)]">{t('daily_today_badge')}</span>
              )}
              {confirmDate !== date && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <X className="size-3" />
                  {t('picker_date_changed')}
                </span>
              )}
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
