'use client';

import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight, Edit, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { QbQuestionWithRelations } from '@/lib/supabase/types';

interface QuestionDetailModalProps {
  question: QbQuestionWithRelations;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function QuestionDetailModal({
  question: q,
  onClose,
  onPrev,
  onNext,
  onEdit,
  onDuplicate,
  onDelete,
}: QuestionDetailModalProps) {
  const t = useTranslations('bancoPreguntas');

  const renderOptions = () => {
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      const opts = q.options as Array<{ text: string; is_correct: boolean }>;
      if (!Array.isArray(opts)) return null;
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('opciones')}
          </p>
          {opts.map((opt, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm ${
                opt.is_correct
                  ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
              }`}
            >
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                opt.is_correct
                  ? 'bg-green-600 text-white'
                  : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt.text}</span>
              {opt.is_correct && (
                <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">✓</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (q.type === 'true_false') {
      const opts = q.options as { correct_answer: boolean };
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('respuesta_correcta')}
          </p>
          <p className="text-sm font-semibold text-[var(--color-brand-gold)]">
            {opts.correct_answer ? t('verdadero') : t('falso')}
          </p>
        </div>
      );
    }

    if (q.type === 'open_ended') {
      const opts = q.options as { model_answer?: string };
      if (!opts.model_answer) return null;
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('respuesta_modelo')}
          </p>
          <div
            className="text-sm text-[var(--color-text-secondary)] prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: opts.model_answer }}
          />
        </div>
      );
    }

    if (q.type === 'fill_blank') {
      const opts = q.options as { blanks: Array<{ accepted_answers: string[] }> };
      if (!opts.blanks?.length) return null;
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('espacios_blanco')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {opts.blanks[0].accepted_answers.map((ans, i) => (
              <span key={i} className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                {ans}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (q.type === 'matching') {
      const opts = q.options as { pairs: Array<{ left: string; right: string }> };
      if (!opts.pairs?.length) return null;
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('matching_par')}es
          </p>
          <div className="space-y-2">
            {opts.pairs.map((pair, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] font-medium">
                  {pair.left}
                </div>
                <div className="rounded-[var(--radius-md)] bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                  {pair.right}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Navigation arrows */}
      {onPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 z-10 flex size-10 items-center justify-center rounded-full bg-[var(--color-bg)] shadow-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 z-10 flex size-10 items-center justify-center rounded-full bg-[var(--color-bg)] shadow-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      {/* Modal content */}
      <div
        className="relative z-10 mx-16 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              {t(`tipo_${q.type}`)}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              q.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              q.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {q.difficulty ? t(`dificultad_${q.difficulty}`) : t('dificultad_sin')}
            </span>
            {q.category_name && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_10%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                {q.category_name}
              </span>
            )}
            {q.subject_name && (
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                {q.subject_name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Question content */}
        <div
          className="text-sm text-[var(--color-text-primary)] prose prose-sm max-w-none mb-5"
          dangerouslySetInnerHTML={{ __html: q.content }}
        />

        {/* Options / Answers */}
        {renderOptions()}

        {/* Explanation */}
        {q.explanation && q.explanation !== '<p></p>' && (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              {t('explicacion')}
            </p>
            <div
              className="text-sm text-[var(--color-text-secondary)] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: q.explanation }}
            />
          </div>
        )}

        {/* Tags */}
        {q.tags && q.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {q.tags.map(tag => (
              <span key={tag.id} className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer: metadata + actions */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <div className="text-xs text-[var(--color-text-muted)]">
            {q.created_by_nombre && (
              <span>{[q.created_by_nombre, q.created_by_apellido, q.created_by_apellido_materno].filter(Boolean).join(' ')} · </span>
            )}
            {format(new Date(q.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
          </div>
          <div className="flex gap-1">
            <Tooltip content={t('editar')}>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
              >
                <Edit className="size-4" />
              </button>
            </Tooltip>
            <Tooltip content={t('duplicar')}>
              <button
                type="button"
                onClick={onDuplicate}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
              >
                <Copy className="size-4" />
              </button>
            </Tooltip>
            <Tooltip content={t('eliminar')}>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
