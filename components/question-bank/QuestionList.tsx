'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Filter, ChevronLeft, ChevronRight, Upload
} from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { ImportModal } from '@/components/question-bank/ImportModal';
import { QuestionDetailModal } from '@/components/question-bank/QuestionDetailModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { QbCategory, QbTag, QbQuestionWithRelations } from '@/lib/supabase/types';
import { questionTypes, difficulties, statuses } from '@/lib/validations/question-bank.schema';

interface QuestionListProps {
  categories: QbCategory[];
  tags: QbTag[];
  onEdit: (id: string) => void;
}

export function QuestionList({ categories, tags: _tags, onEdit }: QuestionListProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '20');
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (categoryFilter) queryParams.set('categoryId', categoryFilter);
  if (typeFilter) queryParams.set('type', typeFilter);
  if (difficultyFilter) queryParams.set('difficulty', difficultyFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (tagFilter.length > 0) queryParams.set('tagIds', tagFilter.join(','));

  const { data, isLoading } = useQuery({
    queryKey: ['qb-questions', queryParams.toString()],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await fetch(`/api/question-bank/questions?${queryParams.toString()}`);
      if (!res.ok) throw new Error();
      return res.json() as Promise<{
        data: QbQuestionWithRelations[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>;
    },
  });

  const questions = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 0;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-bank/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(t('eliminada_ok'));
      queryClient.invalidateQueries({ queryKey: ['qb-questions'] });
      setDeletingId(null);
      setSelectedIdx(null);
    },
    onError: () => {
      toast.error(t('error_eliminar'));
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-bank/questions/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(t('duplicada_ok'));
      queryClient.invalidateQueries({ queryKey: ['qb-questions'] });
    },
  });

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();

  const hasActiveFilters = categoryFilter || typeFilter || difficultyFilter || statusFilter || tagFilter.length > 0;

  const clearFilters = () => {
    setCategoryFilter('');
    setTypeFilter('');
    setDifficultyFilter('');
    setStatusFilter('');
    setTagFilter([]);
    setPage(1);
  };

  const from = (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);

  // Modal navigation
  const selectedQuestion = selectedIdx !== null ? questions[selectedIdx] : null;
  const handlePrev = selectedIdx !== null && selectedIdx > 0 ? () => setSelectedIdx(selectedIdx - 1) : null;
  const handleNext = selectedIdx !== null && selectedIdx < questions.length - 1 ? () => setSelectedIdx(selectedIdx + 1) : null;

  return (
    <div className="space-y-4">
      {/* Search + Actions bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('buscar')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'text-[var(--color-brand-gold)]' : ''}
          >
            <Filter className="size-4 mr-1.5" />
            {t('filtros')}
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-[var(--color-brand-gold)] text-white size-5 text-xs flex items-center justify-center">
                !
              </span>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="size-4 mr-1.5" />
            {t('importar')}
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-[var(--space-md)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_categoria')}
              </label>
              <AppSelect
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setPage(1); }}
                options={[
                  { value: '', label: t('todas_categorias') },
                  ...categories.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_tipo')}
              </label>
              <AppSelect
                value={typeFilter}
                onChange={(v) => { setTypeFilter(v); setPage(1); }}
                options={[
                  { value: '', label: t('todos_tipos') },
                  ...questionTypes.map(qt => ({ value: qt, label: t(`tipo_${qt}`) })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_dificultad')}
              </label>
              <AppSelect
                value={difficultyFilter}
                onChange={(v) => { setDifficultyFilter(v); setPage(1); }}
                options={[
                  { value: '', label: t('todas_dificultades') },
                  { value: 'unrated', label: t('dificultad_sin') },
                  ...difficulties.map(d => ({ value: d, label: t(`dificultad_${d}`) })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_estado')}
              </label>
              <AppSelect
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
                options={[
                  { value: '', label: t('todos_estados') },
                  ...statuses.map(s => ({ value: s, label: t(`estado_${s}`) })),
                ]}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-xs text-[var(--color-brand-gold)] hover:underline"
            >
              {t('limpiar_filtros')}
            </button>
          )}
        </Card>
      )}

      {/* Questions grid */}
      {isLoading && !data ? (
        <div className="flex justify-center py-12">
          <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {debouncedSearch || hasActiveFilters ? t('sin_resultados') : t('sin_preguntas')}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {debouncedSearch || hasActiveFilters ? t('sin_resultados_desc') : t('sin_preguntas_desc')}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className="text-left rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))] p-3.5 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-brand-gold)] hover:shadow-[var(--shadow-md)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] outline-none"
            >
              {/* Content preview */}
              <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug">
                {stripHtml(q.content)}
              </p>
              {/* Metadata */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                  {t(`tipo_${q.type}`)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  q.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  q.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {q.difficulty ? t(`dificultad_${q.difficulty}`) : t('dificultad_sin')}
                </span>
                {q.category_name && (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_10%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand-gold)]">
                    {q.category_name}
                  </span>
                )}
              </div>
              {/* Date */}
              <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                {format(new Date(q.created_at), 'dd MMM yyyy', { locale: es })}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('paginacion_mostrando', { from, to, total })}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-[var(--radius-sm)] p-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="flex items-center px-3 text-sm text-[var(--color-text-primary)] font-medium">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-[var(--radius-sm)] p-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedQuestion && (
        <QuestionDetailModal
          question={selectedQuestion}
          onClose={() => setSelectedIdx(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          onEdit={() => { setSelectedIdx(null); onEdit(selectedQuestion.id); }}
          onDuplicate={() => { duplicateMutation.mutate(selectedQuestion.id); }}
          onDelete={() => { setSelectedIdx(null); setDeletingId(selectedQuestion.id); }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDeleteModal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId); }}
        entityName={t('confirmar_eliminar')}
        entityType="pregunta"
      />

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ['qb-questions'] });
            queryClient.invalidateQueries({ queryKey: ['qb-categories'] });
            queryClient.invalidateQueries({ queryKey: ['qb-tags'] });
          }}
        />
      )}
    </div>
  );
}
