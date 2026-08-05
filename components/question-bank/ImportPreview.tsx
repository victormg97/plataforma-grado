'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Check, X, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { questionTypes, difficulties } from '@/lib/validations/question-bank.schema';

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

interface ImportPreviewProps {
  rows: ImportRow[];
  onChange: (rows: ImportRow[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

type ViewMode = 'review' | 'edit';

export function ImportPreview({ rows, onChange, onConfirm, onCancel, loading }: ImportPreviewProps) {
  const t = useTranslations('bancoPreguntas');
  const [mode, setMode] = useState<ViewMode>('review');
  const [editIdx, setEditIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(rows.map((_, i) => i)));

  const selectedCount = selected.size;
  const totalCount = rows.length;

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, i) => i)));
    }
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

  const currentRow = rows[editIdx];

  const getTypeLabel = (type: string) => {
    const validTypes = questionTypes as readonly string[];
    if (validTypes.includes(type)) return t(`tipo_${type}`);
    return type || '—';
  };

  const getDifficultyLabel = (d: string) => {
    if (!d) return t('dificultad_sin');
    if (d === 'easy' || d === 'medium' || d === 'hard') return t(`dificultad_${d}`);
    return d;
  };

  const formatOptions = (row: ImportRow) => {
    if (row.type === 'true_false') return row.correct || '';
    if (row.type === 'matching') {
      const parts = row.options.split(';').filter(Boolean);
      const pairs: string[] = [];
      for (let i = 0; i + 1 < parts.length; i += 2) {
        pairs.push(`${parts[i]} → ${parts[i + 1]}`);
      }
      return pairs.join('\n');
    }
    const opts = row.options.split(';').filter(Boolean);
    const correctIndices = row.correct ? row.correct.split(',').map(c => parseInt(c.trim()) - 1) : [];
    return opts.map((o, i) => `${correctIndices.includes(i) ? '✓' : '  '} ${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  };

  const handleConfirm = () => {
    // Filter to only selected rows before confirming
    const selectedRows = rows.filter((_, i) => selected.has(i));
    onChange(selectedRows);
    setTimeout(onConfirm, 0);
  };

  return (
    <div className="flex flex-col h-full max-h-[75vh]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t('vista_previa')} — {selectedCount} de {totalCount} {t('preguntas_seleccionadas')}
          </h3>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {mode === 'review' ? (
          <div className="space-y-3">
            {/* Select all */}
            <div className="flex items-center gap-2 mb-2">
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

            {/* Question cards */}
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={`rounded-[var(--radius-md)] border p-4 transition-all ${
                  selected.has(idx)
                    ? 'border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))]'
                    : 'border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      selected.has(idx)
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                        : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]'
                    }`}
                  >
                    {selected.has(idx) && <Check className="size-3" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Type + number */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)]">#{idx + 1}</span>
                      <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                        {getTypeLabel(row.type)}
                      </span>
                      {row.difficulty && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          row.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          row.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getDifficultyLabel(row.difficulty)}
                        </span>
                      )}
                    </div>

                    {/* Question text */}
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      {row.content}
                    </p>

                    {/* Options preview */}
                    {row.options && (
                      <div className="mb-2 text-xs text-[var(--color-text-secondary)] space-y-0.5">
                        {formatOptions(row).split('\n').map((line, i) => (
                          <p key={i} className={line.startsWith('✓') ? 'text-green-600 font-medium' : ''}>
                            {line}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Explanation */}
                    {row.explanation && (
                      <p className="text-xs text-[var(--color-text-muted)] italic mb-2">
                        💡 {row.explanation}
                      </p>
                    )}

                    {/* Metadata badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {row.subject && (
                        <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                          {row.subject}
                        </span>
                      )}
                      {row.category && (
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_10%,transparent)] px-2 py-0.5 text-[10px] text-[var(--color-brand-gold)]">
                          {row.category}
                        </span>
                      )}
                      {row.tags && row.tags.split(',').map((tag, i) => (
                        <span key={i} className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditIdx(idx); setMode('edit'); }}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors"
                    >
                      <Edit className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Edit mode: one question at a time */
          currentRow && (
            <div className="space-y-4">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={editIdx === 0}
                  onClick={() => setEditIdx(i => i - 1)}
                  className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('pregunta_n', { n: editIdx + 1, total: totalCount })}
                </span>
                <button
                  type="button"
                  disabled={editIdx === rows.length - 1}
                  onClick={() => setEditIdx(i => i + 1)}
                  className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>

              {/* Edit fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                    {t('tipo_pregunta')}
                  </label>
                  <AppSelect
                    value={currentRow.type}
                    onChange={(v) => updateRow(editIdx, 'type', v)}
                    options={questionTypes.map(qt => ({ value: qt, label: t(`tipo_${qt}`) }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                    {t('enunciado')}
                  </label>
                  <textarea
                    value={currentRow.content}
                    onChange={(e) => updateRow(editIdx, 'content', e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                    {t('opciones')} (separadas por ;)
                  </label>
                  <textarea
                    value={currentRow.options}
                    onChange={(e) => updateRow(editIdx, 'options', e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                      {t('respuesta_correcta')}
                    </label>
                    <input
                      type="text"
                      value={currentRow.correct}
                      onChange={(e) => updateRow(editIdx, 'correct', e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                      {t('dificultad')}
                    </label>
                    <AppSelect
                      value={currentRow.difficulty}
                      onChange={(v) => updateRow(editIdx, 'difficulty', v)}
                      options={[
                        { value: '', label: t('dificultad_sin') },
                        ...difficulties.map(d => ({ value: d, label: t(`dificultad_${d}`) })),
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                    {t('explicacion')}
                  </label>
                  <textarea
                    value={currentRow.explanation}
                    onChange={(e) => updateRow(editIdx, 'explanation', e.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                      {t('materia')}
                    </label>
                    <input
                      type="text"
                      value={currentRow.subject}
                      onChange={(e) => updateRow(editIdx, 'subject', e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                      {t('categoria')}
                    </label>
                    <input
                      type="text"
                      value={currentRow.category}
                      onChange={(e) => updateRow(editIdx, 'category', e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                      {t('tags')}
                    </label>
                    <input
                      type="text"
                      value={currentRow.tags}
                      onChange={(e) => updateRow(editIdx, 'tags', e.target.value)}
                      placeholder="tag1, tag2"
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {t('cancelar')}
        </Button>
        <Button
          onClick={handleConfirm}
          loading={loading}
          disabled={selectedCount === 0}
        >
          {t('importar_confirmar')} ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
