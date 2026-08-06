'use client';

import { useTranslations } from 'next-intl';
import { Plus, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppSelect } from '@/components/common/AppSelect';
import { questionTypes, difficulties } from '@/lib/validations/question-bank.schema';
import type { QbCategory, QbSubject } from '@/lib/supabase/types';

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

interface ImportQuestionEditorProps {
  row: ImportRow;
  index: number;
  total: number;
  onChange: (field: keyof ImportRow, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  categories: QbCategory[];
  subjects: QbSubject[];
}

/**
 * Lightweight inline editor for import preview.
 * Provides visual option management with click-to-mark-correct UX.
 */
export function ImportQuestionEditor({
  row, index, total, onChange, onPrev, onNext, categories, subjects,
}: ImportQuestionEditorProps) {
  const t = useTranslations('bancoPreguntas');

  // Parse options from ||| separated string
  const options = row.options ? row.options.split('|||').filter(Boolean) : [];
  const correctIndices = row.correct
    ? row.correct.split(',').map(c => parseInt(c.trim()) - 1).filter(n => !isNaN(n))
    : [];

  const isSingleOrMultiple = row.type === 'single_choice' || row.type === 'multiple_choice';
  const isTrueFalse = row.type === 'true_false';

  // ─── Option helpers ──────────────────────────────────────────────────────

  const updateOptions = (newOpts: string[]) => {
    onChange('options', newOpts.join('|||'));
  };

  const updateCorrect = (newIndices: number[]) => {
    onChange('correct', newIndices.map(i => i + 1).join(','));
  };

  const toggleCorrect = (idx: number) => {
    if (row.type === 'single_choice') {
      // Exclusive: only one correct
      updateCorrect(correctIndices.includes(idx) ? [] : [idx]);
    } else {
      // Toggle
      if (correctIndices.includes(idx)) {
        updateCorrect(correctIndices.filter(i => i !== idx));
      } else {
        updateCorrect([...correctIndices, idx].sort());
      }
    }
  };

  const updateOptionText = (idx: number, text: string) => {
    const newOpts = [...options];
    newOpts[idx] = text;
    updateOptions(newOpts);
  };

  const addOption = () => {
    updateOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return; // min 2 options
    const newOpts = options.filter((_, i) => i !== idx);
    // Adjust correct indices
    const newCorrect = correctIndices
      .filter(i => i !== idx)
      .map(i => (i > idx ? i - 1 : i));
    updateOptions(newOpts);
    updateCorrect(newCorrect);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={onPrev}
          className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('pregunta_n', { n: index + 1, total })}
        </span>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onNext}
          className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Type selector */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          {t('tipo_pregunta')}
        </label>
        <AppSelect
          value={row.type}
          onChange={(v) => onChange('type', v)}
          options={questionTypes.map(qt => ({ value: qt, label: t(`tipo_${qt}`) }))}
        />
      </div>

      {/* Content / enunciado */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          {t('enunciado')}
        </label>
        <textarea
          value={row.content}
          onChange={(e) => onChange('content', e.target.value)}
          rows={3}
          className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
        />
      </div>

      {/* Options (single/multiple choice) */}
      {isSingleOrMultiple && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {t('opciones')} — {row.type === 'single_choice' ? 'click para marcar la correcta' : 'click para marcar correctas'}
          </label>
          <div className="space-y-2">
            {options.map((opt, idx) => {
              const isCorrect = correctIndices.includes(idx);
              const letter = String.fromCharCode(65 + idx);
              return (
                <div key={idx} className="flex items-center gap-2">
                  {/* Correct toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCorrect(idx)}
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      isCorrect
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-[var(--color-border)] hover:border-green-400 text-[var(--color-text-muted)]'
                    }`}
                    title={isCorrect ? 'Quitar como correcta' : 'Marcar como correcta'}
                  >
                    {isCorrect ? <Check className="size-3.5" /> : <span className="text-xs font-medium">{letter}</span>}
                  </button>

                  {/* Option text */}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOptionText(idx, e.target.value)}
                    placeholder={`Opción ${letter}`}
                    className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] ${
                      isCorrect
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                        : 'border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))]'
                    }`}
                  />

                  {/* Remove button */}
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                      title="Eliminar opción"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add option button */}
            {options.length < 8 && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors mt-1"
              >
                <Plus className="size-3.5" />
                Agregar opción
              </button>
            )}
          </div>

          {/* No correct answer warning */}
          {correctIndices.length === 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Sin respuesta correcta marcada
            </p>
          )}
        </div>
      )}

      {/* True/False */}
      {isTrueFalse && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {t('respuesta_correcta')}
          </label>
          <div className="flex gap-2">
            {(['verdadero', 'falso'] as const).map((val) => {
              const isSelected = row.correct?.toLowerCase() === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange('correct', val)}
                  className={`flex-1 rounded-[var(--radius-md)] border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    isSelected
                      ? val === 'verdadero'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)]'
                  }`}
                >
                  {val === 'verdadero' ? t('verdadero') : t('falso')}
                </button>
              );
            })}
          </div>
          {!row.correct && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Sin respuesta marcada
            </p>
          )}
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          {t('explicacion')} ({t('opcional')})
        </label>
        <textarea
          value={row.explanation}
          onChange={(e) => onChange('explanation', e.target.value)}
          rows={3}
          className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
        />
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          {t('dificultad')}
        </label>
        <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          {['', ...difficulties].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onChange('difficulty', d)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
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

      {/* Metadata */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            {t('materia')}
          </label>
          <input
            type="text"
            list={`edit-subject-${index}`}
            value={row.subject}
            onChange={(e) => onChange('subject', e.target.value)}
            placeholder={t('materia_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
          <datalist id={`edit-subject-${index}`}>
            {subjects.map(s => <option key={s.id} value={s.name} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            {t('categoria')}
          </label>
          <input
            type="text"
            list={`edit-category-${index}`}
            value={row.category}
            onChange={(e) => onChange('category', e.target.value)}
            placeholder={t('categoria_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
          <datalist id={`edit-category-${index}`}>
            {categories.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            {t('tags')}
          </label>
          <input
            type="text"
            value={row.tags}
            onChange={(e) => onChange('tags', e.target.value)}
            placeholder={t('tags_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
      </div>
    </div>
  );
}
