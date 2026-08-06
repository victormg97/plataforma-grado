'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Check, Eye, Edit, Trash2, ArrowLeft, AlertCircle, CheckCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tooltip } from '@/components/common/Tooltip';
import { ImportQuestionEditor } from '@/components/question-bank/ImportQuestionEditor';
import { questionTypes, difficulties } from '@/lib/validations/question-bank.schema';
import { validateImportRows } from '@/lib/question-bank/import-validation';
import type { QbCategory, QbTag, QbSubject } from '@/lib/supabase/types';

interface ImportRow {
  type: string;
  content: string;
  options: string;
  correct: string;
  explanation: string;
  subject: string;
  category: string;
  tags: string;
  difficulty: string;
}

interface ImportPreviewViewProps {
  rows: ImportRow[];
  onChange: (rows: ImportRow[]) => void;
  onBack: () => void;
  onImported: () => void;
  categories: QbCategory[];
  tags: QbTag[];
  subjects: QbSubject[];
}

type ViewMode = 'review' | 'edit';

const PAGE_SIZE = 21;

export function ImportPreviewView({
  rows, onChange, onBack, onImported, categories, tags: _tags, subjects,
}: ImportPreviewViewProps) {
  const t = useTranslations('bancoPreguntas');

  const [mode, setMode] = useState<ViewMode>('review');
  const [editIdx, setEditIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(rows.map((_, i) => i)));
  const [page, setPage] = useState(1);

  // Bulk metadata state
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkDifficulty, setBulkDifficulty] = useState('');
  const [confirmReplace, setConfirmReplace] = useState<{
    field: string; count: number; action: () => void;
  } | null>(null);

  // Import result
  const [importResult, setImportResult] = useState<{
    success_count: number; error_count: number; errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const selectedCount = selected.size;
  const totalCount = rows.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Selection helpers
  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  };

  const removeRow = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    onChange(newRows);
    setSelected(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
    if (editIdx >= newRows.length) setEditIdx(Math.max(0, newRows.length - 1));
  };

  const updateRow = (idx: number, field: keyof ImportRow, value: string) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    onChange(newRows);
  };

  // Bulk metadata apply with conflict detection
  const applyBulkField = useCallback((field: keyof ImportRow, value: string) => {
    if (!value.trim()) return;
    const selectedIndices = Array.from(selected);
    const conflicting = selectedIndices.filter(i => rows[i][field] && rows[i][field] !== value);

    const doApply = () => {
      const newRows = [...rows];
      selectedIndices.forEach(i => { newRows[i] = { ...newRows[i], [field]: value }; });
      onChange(newRows);
      toast.success(t('aplicar_a_seleccionadas'));
    };

    if (conflicting.length > 0) {
      setConfirmReplace({ field, count: conflicting.length, action: doApply });
    } else {
      doApply();
    }
  }, [rows, selected, onChange, t]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedRows = rows.filter((_, i) => selected.has(i));
      const res = await fetch('/api/question-bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: selectedRows, fileName: 'texto-importado.txt' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      if (data.error_count === 0) {
        toast.success(t('importacion_ok', { count: data.success_count }));
        onImported();
      } else {
        toast.warning(t('importacion_parcial', {
          success: data.success_count,
          total: data.total_rows,
          errors: data.error_count,
        }));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t('error_importar'));
    },
  });

  // Formatting helpers
  const getTypeLabel = (type: string) => {
    const valid = questionTypes as readonly string[];
    if (valid.includes(type)) return t(`tipo_${type}`);
    return type || '—';
  };

  const getDifficultyLabel = (d: string) => {
    if (!d) return t('dificultad_sin');
    if (d === 'easy' || d === 'medium' || d === 'hard') return t(`dificultad_${d}`);
    return d;
  };

  const formatOptions = (row: ImportRow) => {
    if (row.type === 'true_false') {
      const answer = row.correct?.toLowerCase();
      const label = answer === 'verdadero' || answer === 'true' ? t('verdadero') : t('falso');
      return t('respuesta_correcta_vf', { answer: label });
    }
    if (row.type === 'matching') {
      const parts = row.options.split('|||').filter(Boolean);
      const pairs: string[] = [];
      for (let i = 0; i + 1 < parts.length; i += 2) {
        pairs.push(`${parts[i]} → ${parts[i + 1]}`);
      }
      return pairs.join('\n');
    }
    const opts = row.options.split('|||').filter(Boolean);
    const correctIndices = row.correct ? row.correct.split(',').map(c => parseInt(c.trim()) - 1) : [];
    return opts.map((o, i) => `${correctIndices.includes(i) ? '✓' : '  '} ${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  };

  const currentRow = rows[editIdx];

  // Import result view
  if (importResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-green-500" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {importResult.success_count} importadas correctamente
          </span>
        </div>
        {importResult.error_count > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="size-4 text-[var(--color-error)]" />
              <span className="text-sm font-medium text-[var(--color-error)]">
                {importResult.error_count} {t('errores')}
              </span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {importResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t('fila')} {err.row}:</span> {err.message}
                </p>
              ))}
            </div>
          </div>
        )}
        <Button onClick={onBack}>{t('volver_a_pegar')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with back + mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tooltip content={t('tooltip_volver_importar')}>
            <button
              type="button"
              onClick={onBack}
              className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <ArrowLeft className="size-5" />
            </button>
          </Tooltip>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('vista_previa')} — {selectedCount} de {totalCount} {t('preguntas_seleccionadas')}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('review')}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-all ${
              mode === 'review'
                ? 'bg-[var(--color-brand-gold)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)]'
            }`}
          >
            <Eye className="size-3.5" />
            {t('modo_revisar')}
          </button>
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-all ${
              mode === 'edit'
                ? 'bg-[var(--color-brand-gold)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)]'
            }`}
          >
            <Edit className="size-3.5" />
            {t('modo_editar')}
          </button>
        </div>
      </div>

      {/* Bulk metadata section */}
      {mode === 'review' && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))] p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">
            {t('metadata_masiva')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {t('materia')}
              </label>
              <div className="flex gap-1">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    list="bulk-subject-list"
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    placeholder={t('materia_placeholder')}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                  <datalist id="bulk-subject-list">
                    {subjects.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                </div>
                {bulkSubject && (
                  <button
                    type="button"
                    onClick={() => applyBulkField('subject', bulkSubject)}
                    className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] p-1.5 text-white hover:opacity-90 transition-opacity"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {t('categoria')}
              </label>
              <div className="flex gap-1">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    list="bulk-category-list"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    placeholder={t('categoria_placeholder')}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                  <datalist id="bulk-category-list">
                    {categories.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                {bulkCategory && (
                  <button
                    type="button"
                    onClick={() => applyBulkField('category', bulkCategory)}
                    className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] p-1.5 text-white hover:opacity-90 transition-opacity"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {t('tags')}
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                  placeholder="tag1, tag2"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                {bulkTags && (
                  <button
                    type="button"
                    onClick={() => applyBulkField('tags', bulkTags)}
                    className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] p-1.5 text-white hover:opacity-90 transition-opacity"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {t('dificultad')}
              </label>
              <div className="flex gap-1">
                <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBulkDifficulty(prev => prev === 'none' ? '' : 'none')}
                    className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                      bulkDifficulty === 'none'
                        ? 'bg-[var(--color-brand-gold)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    {t('dificultad_sin')}
                  </button>
                  {difficulties.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBulkDifficulty(prev => prev === d ? '' : d)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        bulkDifficulty === d
                          ? 'bg-[var(--color-brand-gold)] text-white'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      {t(`dificultad_${d}`)}
                    </button>
                  ))}
                </div>
                {bulkDifficulty && (
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkDifficulty === 'none') {
                        // Apply empty string = clear difficulty
                        const selectedIndices = Array.from(selected);
                        const newRows = [...rows];
                        selectedIndices.forEach(idx => { newRows[idx] = { ...newRows[idx], difficulty: '' }; });
                        onChange(newRows);
                        toast.success(t('aplicar_a_seleccionadas'));
                        setBulkDifficulty('');
                      } else {
                        applyBulkField('difficulty', bulkDifficulty);
                      }
                    }}
                    className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] p-1.5 text-white hover:opacity-90 transition-opacity"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {mode === 'review' ? (
        <div className="space-y-3">
          {/* Select all */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
                selected.size === rows.length
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                  : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]'
              }`}
            >
              {selected.size === rows.length && <Check className="size-3" />}
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">
              {t('seleccionar_todo')}
            </span>
          </div>

          {/* Question cards (paginated) */}
          {pageRows.map((row, pageIdx) => {
            const globalIdx = (page - 1) * PAGE_SIZE + pageIdx;
            return (
              <div
                key={globalIdx}
                className={`rounded-[var(--radius-md)] border p-4 transition-all ${
                  selected.has(globalIdx)
                    ? 'border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))]'
                    : 'border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(globalIdx)}
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      selected.has(globalIdx)
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                        : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]'
                    }`}
                  >
                    {selected.has(globalIdx) && <Check className="size-3" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)]">#{globalIdx + 1}</span>
                      <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                        {getTypeLabel(row.type)}
                      </span>
                      {row.difficulty && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          row.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          row.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {getDifficultyLabel(row.difficulty)}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2 whitespace-pre-line">
                      {row.content}
                    </div>

                    {/* Options / answer preview */}
                    {(row.options || row.type === 'true_false') && (
                      <div className="mb-2 text-xs text-[var(--color-text-secondary)]">
                        {row.type === 'true_false' ? (
                          <p className="font-medium">
                            {formatOptions(row)}
                          </p>
                        ) : row.type === 'matching' ? (
                          <table className="w-full border-collapse text-xs">
                            <tbody>
                              {row.options.split('|||').filter(Boolean).reduce<Array<{ left: string; right: string }>>((acc, part, idx, arr) => {
                                if (idx % 2 === 0 && idx + 1 < arr.length) {
                                  acc.push({ left: part, right: arr[idx + 1] });
                                }
                                return acc;
                              }, []).map((pair, pi) => (
                                <tr key={pi} className="border-b border-[var(--color-border)] last:border-b-0">
                                  <td className="py-1 pr-3 font-medium text-[var(--color-text-primary)]">{pair.left}</td>
                                  <td className="py-1 text-[var(--color-text-secondary)]">{pair.right}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="space-y-0.5">
                            {row.options.split('|||').filter(Boolean).map((opt, oi) => {
                              const correctIndices = row.correct ? row.correct.split(',').map(c => parseInt(c.trim()) - 1) : [];
                              const isCorrect = correctIndices.includes(oi);
                              return (
                                <p key={oi} className={isCorrect ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                                  {isCorrect ? '✓ ' : '  '}{String.fromCharCode(65 + oi)}) {opt}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {row.explanation && (
                      <div className="text-xs text-[var(--color-text-muted)] italic mb-2 whitespace-pre-line">
                        💡 {row.explanation}
                      </div>
                    )}

                    {/* Inline metadata editing */}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="relative">
                        <input
                          type="text"
                          list={`subject-list-${globalIdx}`}
                          value={row.subject}
                          onChange={(e) => updateRow(globalIdx, 'subject', e.target.value)}
                          placeholder={t('materia_placeholder')}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                        />
                        <datalist id={`subject-list-${globalIdx}`}>
                          {subjects.map(s => <option key={s.id} value={s.name} />)}
                        </datalist>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list={`category-list-${globalIdx}`}
                          value={row.category}
                          onChange={(e) => updateRow(globalIdx, 'category', e.target.value)}
                          placeholder={t('categoria_placeholder')}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                        />
                        <datalist id={`category-list-${globalIdx}`}>
                          {categories.map(c => <option key={c.id} value={c.name} />)}
                        </datalist>
                      </div>
                      <input
                        type="text"
                        value={row.tags}
                        onChange={(e) => updateRow(globalIdx, 'tags', e.target.value)}
                        placeholder={t('tags_placeholder')}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                      />
                    </div>
                    {/* Difficulty toggle per question */}
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] text-[var(--color-text-muted)] mr-1">{t('dificultad')}:</span>
                      <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                        {['', ...difficulties].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => updateRow(globalIdx, 'difficulty', d)}
                            className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                              row.difficulty === d
                                ? 'bg-[var(--color-brand-gold)] text-white'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                            }`}
                          >
                            {d ? t(`dificultad_${d}`) : t('dificultad_sin')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditIdx(globalIdx); setMode('edit'); }}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors"
                    >
                      <Edit className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(globalIdx)}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Edit mode: one question at a time using ImportQuestionEditor */
        currentRow && (
          <ImportQuestionEditor
            row={currentRow}
            index={editIdx}
            total={totalCount}
            onChange={(field, value) => updateRow(editIdx, field, value)}
            onPrev={() => setEditIdx(i => i - 1)}
            onNext={() => setEditIdx(i => i + 1)}
            categories={categories}
            subjects={subjects}
          />
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && mode === 'review' && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('paginacion_mostrando', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, totalCount),
              total: totalCount,
            })}
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

      {/* Footer */}
      <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
        {/* Validation warnings */}
        {(() => {
          const validation = validateImportRows(rows, selected);
          if (!validation.valid) {
            return (
              <div className="rounded-[var(--radius-md)] border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      {validation.issueCount} {validation.issueCount === 1 ? 'pregunta requiere corrección' : 'preguntas requieren corrección'}
                    </p>
                    <div className="mt-1.5 max-h-[120px] overflow-y-auto space-y-0.5">
                      {validation.issues.map((issue, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const targetPage = Math.ceil(issue.questionNumber / PAGE_SIZE);
                            setPage(targetPage);
                            setEditIdx(issue.questionNumber - 1);
                            setMode('edit');
                          }}
                          className="block w-full text-left text-xs text-amber-700 dark:text-amber-400 hover:underline"
                        >
                          → #{issue.questionNumber}: {issue.issueType === 'no_correct_answer'
                            ? 'sin respuesta correcta'
                            : issue.issueType === 'no_true_false_answer'
                            ? 'sin respuesta V/F'
                            : 'sin opciones'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={importMutation.isPending}>
            {t('volver_a_pegar')}
          </Button>
          <Button
            onClick={() => {
              const validation = validateImportRows(rows, selected);
              if (!validation.valid) {
                toast.error(`${validation.issueCount} pregunta(s) sin respuesta. Corrígelas antes de importar.`);
                return;
              }
              importMutation.mutate();
            }}
            loading={importMutation.isPending}
            disabled={selectedCount === 0}
          >
            {t('importar_confirmar')} ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Confirm replace modal */}
      <ConfirmModal
        open={confirmReplace !== null}
        onClose={() => setConfirmReplace(null)}
        onConfirm={() => {
          confirmReplace?.action();
          setConfirmReplace(null);
        }}
        title={t('confirmar_reemplazo')}
        description={t('confirmar_reemplazo_desc', {
          field: confirmReplace?.field || '',
          count: confirmReplace?.count || 0,
        })}
        confirmText={t('aplicar_a_seleccionadas')}
      />
    </div>
  );
}
