'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Filter, ChevronLeft, ChevronRight, Upload, Edit, Copy, Trash2
} from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { Tooltip } from '@/components/common/Tooltip';
import { ConfirmModal } from '@/components/common/ConfirmModal';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Search handler (instant, no debounce needed for client-side)
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Load ALL questions once, filter client-side
  const { data: allQuestions = [], isLoading } = useQuery<QbQuestionWithRelations[]>({
    queryKey: ['qb-questions-all'],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Fetch all questions in one call (page_size=9999)
      const res = await fetch('/api/question-bank/questions?page=1&pageSize=9999');
      if (!res.ok) throw new Error();
      const json = await res.json();
      return json.data || [];
    },
  });

  // Client-side filtering
  const filteredQuestions = useMemo(() => {
    let result = allQuestions;

    // Text search (strip HTML and search in plain text)
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(q => {
        const plain = q.content.replace(/<[^>]*>/g, '').toLowerCase();
        return plain.includes(term);
      });
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter(q => q.category_id === categoryFilter);
    }

    // Type filter
    if (typeFilter) {
      result = result.filter(q => q.type === typeFilter);
    }

    // Difficulty filter
    if (difficultyFilter) {
      if (difficultyFilter === 'unrated') {
        result = result.filter(q => !q.difficulty);
      } else {
        result = result.filter(q => q.difficulty === difficultyFilter);
      }
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(q => q.status === statusFilter);
    }

    // Tag filter
    if (tagFilter.length > 0) {
      result = result.filter(q =>
        q.tags && tagFilter.some(tf => q.tags!.some(qt => qt.id === tf))
      );
    }

    // Date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime();
      result = result.filter(q => new Date(q.created_at).getTime() >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo + 'T23:59:59').getTime();
      result = result.filter(q => new Date(q.created_at).getTime() <= toDate);
    }

    return result;
  }, [allQuestions, search, categoryFilter, typeFilter, difficultyFilter, statusFilter, tagFilter, dateFrom, dateTo]);

  // Client-side pagination
  const PAGE_SIZE = 21; // 3 columns × 7 rows
  const total = filteredQuestions.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const questions = filteredQuestions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-bank/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(t('eliminada_ok'));
      queryClient.invalidateQueries({ queryKey: ['qb-questions-all'] });
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
      queryClient.invalidateQueries({ queryKey: ['qb-questions-all'] });
    },
  });

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();

  const hasActiveFilters = categoryFilter || typeFilter || difficultyFilter || statusFilter || tagFilter.length > 0 || dateFrom || dateTo;

  const clearFilters = () => {
    setCategoryFilter('');
    setTypeFilter('');
    setDifficultyFilter('');
    setStatusFilter('');
    setTagFilter([]);
    setDateFrom('');
    setDateTo('');
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_fecha_desde')}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                {t('filtro_fecha_hasta')}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
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
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {search || hasActiveFilters ? t('sin_resultados') : t('sin_preguntas')}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {search || hasActiveFilters ? t('sin_resultados_desc') : t('sin_preguntas_desc')}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {questions.map((q, idx) => {
            // Build a short answer preview
            let answerPreview = '';
            if (q.type === 'single_choice' || q.type === 'multiple_choice') {
              const opts = q.options as Array<{ text: string; is_correct: boolean }>;
              if (Array.isArray(opts)) {
                answerPreview = opts.map((o, i) => `${String.fromCharCode(65 + i)}) ${o.text}`).slice(0, 3).join(' · ');
                if (opts.length > 3) answerPreview += ' …';
              }
            } else if (q.type === 'true_false') {
              const opts = q.options as { correct_answer: boolean };
              answerPreview = opts.correct_answer ? t('verdadero') : t('falso');
            } else if (q.type === 'open_ended') {
              const opts = q.options as { model_answer?: string };
              if (opts.model_answer) answerPreview = stripHtml(opts.model_answer);
            } else if (q.type === 'fill_blank') {
              const opts = q.options as { blanks: Array<{ accepted_answers: string[] }> };
              if (opts.blanks?.[0]) answerPreview = opts.blanks[0].accepted_answers.join(', ');
            } else if (q.type === 'matching') {
              const opts = q.options as { pairs: Array<{ left: string; right: string }> };
              if (opts.pairs?.length) {
                answerPreview = opts.pairs.slice(0, 2).map(p => `${p.left} → ${p.right}`).join(' · ');
                if (opts.pairs.length > 2) answerPreview += ' …';
              }
            }

            return (
              <div
                key={q.id}
                className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-brand-gold)] hover:shadow-[var(--shadow-md)]"
              >
                {/* Clickable body */}
                <button
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className="flex-1 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] rounded-t-[var(--radius-md)]"
                >
                  {/* Content preview */}
                  <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug">
                    {stripHtml(q.content)}
                  </p>
                  {/* Answer preview */}
                  {answerPreview && (
                    <p className="mt-1.5 text-xs text-[var(--color-text-muted)] line-clamp-1">
                      {answerPreview}
                    </p>
                  )}
                  {/* Badges */}
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
                    {q.status === 'draft' && (
                      <span className="rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 text-[10px] font-medium">
                        {t('estado_draft')}
                      </span>
                    )}
                  </div>
                </button>
                {/* Footer: date + actions */}
                <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3.5 py-2">
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {format(new Date(q.created_at), 'dd MMM yyyy', { locale: es })}
                  </p>
                  <div className="flex gap-0.5">
                    <Tooltip content={t('editar')}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(q.id); }}
                        className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
                      >
                        <Edit className="size-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('duplicar')}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(q.id); }}
                        className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('eliminar')}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingId(q.id); }}
                        className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
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
      <ConfirmModal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId); }}
        title={t('confirmar_eliminar')}
        description={t('confirmar_eliminar_desc')}
        confirmText={t('eliminar')}
        loading={deleteMutation.isPending}
      />

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ['qb-questions-all'] });
            queryClient.invalidateQueries({ queryKey: ['qb-categories'] });
            queryClient.invalidateQueries({ queryKey: ['qb-tags'] });
          }}
        />
      )}
    </div>
  );
}
