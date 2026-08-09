'use client';

import { useTranslations } from 'next-intl';
import { Plus, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { SubjectSelector } from '@/components/question-bank/SubjectSelector';
import { CategorySelector } from '@/components/question-bank/CategorySelector';
import { TagSelector } from '@/components/question-bank/TagSelector';
import { AppSelect } from '@/components/common/AppSelect';
import { questionTypes, difficulties } from '@/lib/validations/question-bank.schema';
import type { QbCategory, QbSubject, QbTag } from '@/lib/supabase/types';

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
  tags: QbTag[];
}

/**
 * Full-featured inline editor for import preview.
 * Supports all question types: single_choice, multiple_choice, true_false,
 * open_ended, fill_blank, and matching.
 */
export function ImportQuestionEditor({
  row, index, total, onChange, onPrev, onNext, categories, subjects, tags,
}: ImportQuestionEditorProps) {
  const t = useTranslations('bancoPreguntas');

  // Parse options from ||| separated string
  const options = row.options ? row.options.split('|||').filter(Boolean) : [];
  const correctIndices = row.correct
    ? row.correct.split(',').map(c => parseInt(c.trim()) - 1).filter(n => !isNaN(n))
    : [];

  const isSingleOrMultiple = row.type === 'single_choice' || row.type === 'multiple_choice';
  const isTrueFalse = row.type === 'true_false';
  const isMatching = row.type === 'matching';
  const isFillBlank = row.type === 'fill_blank';
  const isOpenEnded = row.type === 'open_ended';

  // ─── Option helpers (single/multiple choice) ─────────────────────────────

  const updateOptions = (newOpts: string[]) => {
    onChange('options', newOpts.join('|||'));
  };

  const updateCorrect = (newIndices: number[]) => {
    onChange('correct', newIndices.map(i => i + 1).join(','));
  };

  const toggleCorrect = (idx: number) => {
    if (row.type === 'single_choice') {
      updateCorrect(correctIndices.includes(idx) ? [] : [idx]);
    } else {
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
    if (options.length <= 2) return;
    const newOpts = options.filter((_, i) => i !== idx);
    const newCorrect = correctIndices
      .filter(i => i !== idx)
      .map(i => (i > idx ? i - 1 : i));
    updateOptions(newOpts);
    updateCorrect(newCorrect);
  };

  // ─── Matching helpers ─────────────────────────────────────────────────────

  const getMatchingPairs = (): Array<{ left: string; right: string }> => {
    if (!row.options) return [{ left: '', right: '' }, { left: '', right: '' }];
    const parts = row.options.split('|||').filter(Boolean);
    const pairs: Array<{ left: string; right: string }> = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      pairs.push({ left: parts[i], right: parts[i + 1] });
    }
    if (pairs.length < 2) {
      while (pairs.length < 2) pairs.push({ left: '', right: '' });
    }
    return pairs;
  };

  const setMatchingPairs = (pairs: Array<{ left: string; right: string }>) => {
    const serialized = pairs.map(p => `${p.left}|||${p.right}`).join('|||');
    onChange('options', serialized);
  };

  const matchingPairs = getMatchingPairs();

  const updatePairField = (idx: number, field: 'left' | 'right', value: string) => {
    const newPairs = [...matchingPairs];
    newPairs[idx] = { ...newPairs[idx], [field]: value };
    // Auto-expand: add new empty pair if typing in the last one
    if (idx === newPairs.length - 1 && value.trim()) {
      newPairs.push({ left: '', right: '' });
    }
    setMatchingPairs(newPairs);
  };

  const removePair = (idx: number) => {
    if (matchingPairs.length <= 2) return;
    const newPairs = matchingPairs.filter((_, i) => i !== idx);
    if (!newPairs[newPairs.length - 1]?.left && !newPairs[newPairs.length - 1]?.right) {
      // Already has an empty slot at end
    } else {
      newPairs.push({ left: '', right: '' });
    }
    setMatchingPairs(newPairs);
  };

  const addPair = () => {
    setMatchingPairs([...matchingPairs, { left: '', right: '' }]);
  };

  // ─── Fill blank helpers ───────────────────────────────────────────────────

  const getFillBlankAnswers = (): string[] => {
    // Fill blank answers are stored in `correct` field as semicolon-separated
    if (!row.correct) return [''];
    return row.correct.split(';').map(a => a.trim()).filter(Boolean).length > 0
      ? row.correct.split(';').map(a => a.trim())
      : [''];
  };

  const fillBlankAnswers = getFillBlankAnswers();

  const updateFillBlankAnswer = (idx: number, value: string) => {
    const newAnswers = [...fillBlankAnswers];
    newAnswers[idx] = value;
    onChange('correct', newAnswers.join(';'));
  };

  const addFillBlankAnswer = () => {
    onChange('correct', [...fillBlankAnswers, ''].join(';'));
  };

  const removeFillBlankAnswer = (idx: number) => {
    if (fillBlankAnswers.length <= 1) return;
    const newAnswers = fillBlankAnswers.filter((_, i) => i !== idx);
    onChange('correct', newAnswers.join(';'));
  };

  // ─── Metadata helpers (convert between name-based ImportRow and id-based) ──

  const subjectId = subjects.find(s => s.name === row.subject)?.id || null;
  const categoryId = categories.find(c => c.name === row.category)?.id || null;
  const tagIds = row.tags
    ? row.tags.split(',').map(t => t.trim()).map(name => tags.find(tag => tag.name === name)?.id).filter(Boolean) as string[]
    : [];

  const handleSubjectChange = (id: string | null) => {
    const name = id ? subjects.find(s => s.id === id)?.name || '' : '';
    onChange('subject', name);
  };

  const handleCategoryChange = (id: string | null) => {
    const name = id ? categories.find(c => c.id === id)?.name || '' : '';
    onChange('category', name);
  };

  const handleTagsChange = (ids: string[]) => {
    const names = ids.map(id => tags.find(t => t.id === id)?.name || '').filter(Boolean);
    onChange('tags', names.join(', '));
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

      {/* Matching pairs */}
      {isMatching && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {t('matching_par')}es — Concepto → Definición
          </label>
          <div className="space-y-2">
            {matchingPairs.map((pair, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={pair.left}
                  onChange={(e) => updatePairField(idx, 'left', e.target.value)}
                  placeholder={`${t('matching_concepto')} ${idx + 1}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                <input
                  type="text"
                  value={pair.right}
                  onChange={(e) => updatePairField(idx, 'right', e.target.value)}
                  placeholder={`${t('matching_definicion')} ${idx + 1}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                {matchingPairs.length > 2 && idx < matchingPairs.length - 1 && (
                  <button
                    type="button"
                    onClick={() => removePair(idx)}
                    className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                )}
                {(matchingPairs.length <= 2 || idx >= matchingPairs.length - 1) && (
                  <div className="w-6" /> // Spacer
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addPair}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors mt-1"
            >
              <Plus className="size-3.5" />
              Agregar par
            </button>
          </div>
          {matchingPairs.filter(p => p.left.trim() && p.right.trim()).length < 2 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Se necesitan al menos 2 pares completos
            </p>
          )}
        </div>
      )}

      {/* Fill in the blank */}
      {isFillBlank && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {t('espacios_blanco')}
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Usa ___ en el enunciado para indicar espacios en blanco. Separa respuestas alternativas con ;
          </p>
          <div className="space-y-2">
            {fillBlankAnswers.map((answer, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => updateFillBlankAnswer(idx, e.target.value)}
                  placeholder="Respuesta(s) válida(s) separadas por ;"
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                {fillBlankAnswers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFillBlankAnswer(idx)}
                    className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFillBlankAnswer}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors mt-1"
            >
              <Plus className="size-3.5" />
              {t('agregar_respuesta')}
            </button>
          </div>
          {fillBlankAnswers.every(a => !a.trim()) && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Se necesita al menos una respuesta válida
            </p>
          )}
        </div>
      )}

      {/* Open-ended: model answer */}
      {isOpenEnded && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            {t('respuesta_modelo')}
          </label>
          <textarea
            value={row.correct || ''}
            onChange={(e) => onChange('correct', e.target.value)}
            rows={3}
            placeholder={t('respuesta_modelo_placeholder')}
            className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
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

      {/* Metadata — using reusable selectors */}
      <div className="space-y-3">
        <SubjectSelector
          subjects={subjects}
          value={subjectId}
          onChange={handleSubjectChange}
          compact
        />
        <CategorySelector
          categories={categories}
          value={categoryId}
          onChange={handleCategoryChange}
          compact
        />
        <TagSelector
          tags={tags}
          selectedIds={tagIds}
          onChange={handleTagsChange}
          compact
        />
      </div>
    </div>
  );
}
