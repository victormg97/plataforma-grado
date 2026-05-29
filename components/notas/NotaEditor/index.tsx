'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RichTextEditor } from '@/components/common/RichTextEditor';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotaEditorProps = {
  contenido?: string;
  placeholder?: string;
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  submitLabel?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NotaEditor({ contenido, placeholder, onSubmit, onCancel, loading, submitLabel }: NotaEditorProps) {
  const t = useTranslations('notas');
  const [currentHtml, setCurrentHtml] = useState(contenido ?? '');
  const isEmpty = !currentHtml || currentHtml === '<p></p>' || currentHtml.trim() === '';

  const handleSubmit = () => {
    if (isEmpty) return;
    onSubmit(currentHtml);
    if (!contenido) {
      setCurrentHtml('');
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
      <RichTextEditor
        content={contenido}
        placeholder={placeholder}
        onChange={setCurrentHtml}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-3 py-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-sm)]"
          >
            {t('cancelar')}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isEmpty}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
        >
          {loading ? (
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : null}
          {submitLabel ?? t('guardar_nota')}
        </button>
      </div>
    </div>
  );
}
