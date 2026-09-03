'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Scale, ChevronLeft, ChevronRight, Check, Star, Sparkles, X, User } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { RichDescription } from '@/components/common/RichDescription';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';
import {
  useCaseAnswers,
  useGradeCaseAnswer,
  useAdminWeeklyCases,
  type CaseAnswerRow,
} from '@/lib/hooks/useComunidadAdmin';

const PAGE_SIZE = 8;
type StatusFilter = 'pending' | 'graded' | 'all';

/** Admin inbox to review and grade weekly-case answers. */
export function CaseReviewInbox() {
  const t = useTranslations('comunidadEstrategica');

  const [caseId, setCaseId] = useShallowQueryParam('case');
  const [userId, setUserId] = useShallowQueryParam('user');
  const [statusParam, setStatusParam] = useShallowQueryParam('status');
  const [page, setPage] = useState(1);

  const status: StatusFilter =
    statusParam === 'graded' ? 'graded' : statusParam === 'all' ? 'all' : 'pending';

  const { data: cases } = useAdminWeeklyCases();
  const { data, isLoading, isError, isFetching, refetch } = useCaseAnswers({
    caseId: caseId || null,
    userId: userId || null,
    status: status === 'all' ? null : status,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = data?.data ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const resetPage = () => setPage(1);

  return (
    <div>
      <BackButton fallback="/admin/comunidad?tab=weekly-case" className="mb-3" />
      <PageHeader title={t('review_inbox_title')} subtitle={t('review_inbox_subtitle')} />

      <div className="mt-[var(--space-lg)] flex flex-col gap-4">
        {/* Filters */}
        <div className="grid gap-2 sm:grid-cols-2">
          <AppSelect
            value={caseId ?? ''}
            onChange={(v) => {
              setCaseId(v || null);
              resetPage();
            }}
            options={[
              { value: '', label: t('review_all_cases') },
              ...(cases ?? []).map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
          <AppSelect
            value={status}
            onChange={(v) => {
              setStatusParam(v === 'pending' ? null : v);
              resetPage();
            }}
            options={[
              { value: 'pending', label: t('review_status_pending') },
              { value: 'graded', label: t('review_status_graded') },
              { value: 'all', label: t('review_status_all') },
            ]}
          />
        </div>

        {/* Active user filter chip */}
        {userId && (
          <button
            type="button"
            onClick={() => {
              setUserId(null);
              resetPage();
            }}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--color-brand-gold-muted)] px-3 py-1 text-xs font-medium text-[var(--color-brand-gold)]"
          >
            <User className="size-3.5" />
            {t('review_filtered_by_player')}
            <X className="size-3.5" />
          </button>
        )}

        {/* List */}
        {isError ? (
          <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
            <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
            <Button variant="secondary" onClick={() => refetch()}>{t('error_retry')}</Button>
          </Card>
        ) : isLoading ? (
          <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>
        ) : rows.length === 0 ? (
          <Card padding="lg" className="flex flex-col items-center gap-3 py-10 text-center">
            <Scale className="size-8 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">{t('review_empty')}</p>
          </Card>
        ) : (
          <div className={`flex flex-col gap-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {rows.map((row) => (
              <GradeCard key={`${row.case_id}:${row.user_id}`} row={row} />
            ))}
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
      </div>
    </div>
  );
}

/** One answer with an inline grading form. */
function GradeCard({ row }: { row: CaseAnswerRow }) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;
  const grade = useGradeCaseAnswer();

  const [score, setScore] = useState<number | null>(row.quality_score);
  const [points, setPoints] = useState<number>(row.points_awarded ?? 0);
  const [feedback, setFeedback] = useState(row.feedback ?? '');

  const displayName = useMemo(
    () =>
      row.nickname ||
      [row.nombre, row.apellido].filter(Boolean).join(' ') ||
      row.email ||
      row.user_id,
    [row]
  );

  const fmt = (iso: string) => {
    try {
      return format(new Date(iso), 'PPp', { locale: dfLocale });
    } catch {
      return iso;
    }
  };

  const save = async () => {
    try {
      await grade.mutateAsync({
        case_id: row.case_id,
        user_id: row.user_id,
        quality_score: score,
        points: Math.max(points, 0),
        feedback: feedback.trim() || null,
      });
      toast.success(t('review_graded_ok'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      {/* Header: player + status + case */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--color-text-primary)]">{displayName}</span>
            {row.graded ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                <Check className="size-3" /> {t('review_status_graded')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[var(--color-error)]/12 px-2 py-0.5 text-xs font-medium text-[var(--color-error)]">
                {t('review_status_pending')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {row.case_title} · {t('review_submitted_at', { date: fmt(row.submitted_at) })}
          </p>
        </div>
      </div>

      {/* The answer */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
        <RichDescription html={row.answer_content} className="text-[var(--color-text-primary)]" />
      </div>

      {/* Grading form */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Quality score 0..5 (optional) */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('review_quality_label')}
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (score ?? 0) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={String(n)}
                    onClick={() => setScore(score === n ? null : n)}
                    className="p-0.5"
                  >
                    <Star
                      className={`size-6 ${active ? 'fill-[var(--color-brand-gold)] text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]'}`}
                    />
                  </button>
                );
              })}
              {score !== null && (
                <button
                  type="button"
                  onClick={() => setScore(null)}
                  className="ml-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  {t('review_clear_score')}
                </button>
              )}
            </div>
          </div>

          {/* XP points */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('review_points_label')}
            </span>
            <div className="relative">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-brand-gold)]" />
              <input
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-9 pr-3 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
              />
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('review_feedback_label')}
          </span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={t('review_feedback_placeholder')}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>

        <div className="flex justify-end">
          <Button onClick={save} loading={grade.isPending}>
            {row.graded ? t('review_update_grade') : t('review_save_grade')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
