'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from '@/components/common/Tooltip';
import { parseClipboard, type ParsedChoiceOption, type ParsedMatchingPair } from '@/lib/question-bank/paste-helper';

interface PasteButtonProps {
  type: 'choices' | 'matching';
  onPasteChoices: (options: ParsedChoiceOption[]) => void;
  onPasteMatching: (pairs: ParsedMatchingPair[]) => void;
  onUndo: () => void;
}

export function PasteButton({ type, onPasteChoices, onPasteMatching, onUndo }: PasteButtonProps) {
  const t = useTranslations('bancoPreguntas');
  const [preview, setPreview] = useState<{
    type: 'choices' | 'matching';
    options?: ParsedChoiceOption[];
    pairs?: ParsedMatchingPair[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleHover = useCallback(async () => {
    try {
      // Read clipboard on hover for preview
      const text = await navigator.clipboard.readText();
      let html: string | undefined;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            html = await blob.text();
          }
        }
      } catch { /* HTML not available, that's fine */ }

      const result = parseClipboard(text, html, type);
      if (result.type !== 'unknown') {
        setPreview({ type: result.type, options: result.options, pairs: result.pairs });
        setShowPreview(true);
      } else {
        setPreview(null);
        setShowPreview(false);
      }
    } catch {
      // Clipboard permission denied or empty
      setPreview(null);
      setShowPreview(false);
    }
  }, [type]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      let html: string | undefined;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            html = await blob.text();
          }
        }
      } catch { /* no HTML */ }

      const result = parseClipboard(text, html, type);

      if (result.type === 'choices' && result.options) {
        onPasteChoices(result.options);
        toast.success(t('pegado_ok', { count: result.options.length }), {
          action: { label: t('deshacer'), onClick: onUndo },
          duration: 5000,
        });
      } else if (result.type === 'matching' && result.pairs) {
        onPasteMatching(result.pairs);
        toast.success(t('pegado_ok', { count: result.pairs.length }), {
          action: { label: t('deshacer'), onClick: onUndo },
          duration: 5000,
        });
      } else {
        toast.error(t('pegado_error'));
      }
    } catch {
      toast.error(t('pegado_permiso'));
    }
    setShowPreview(false);
  }, [type, onPasteChoices, onPasteMatching, onUndo, t]);

  return (
    <div className="relative inline-block">
      <Tooltip content={t('pegar_opciones')}>
        <button
          type="button"
          onClick={handlePaste}
          onMouseEnter={handleHover}
          onMouseLeave={() => setShowPreview(false)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-all hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_5%,transparent)]"
        >
          <ClipboardPaste className="size-3.5" />
          {t('pegar')}
        </button>
      </Tooltip>

      {/* Preview popup on hover */}
      {showPreview && preview && (
        <div className="absolute left-0 top-full mt-2 z-20 w-72 max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] p-3 animate-in fade-in-0 zoom-in-95 duration-150">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {t('vista_previa_pegado')}
          </p>
          {preview.type === 'choices' && preview.options && (
            <div className="space-y-1">
              {preview.options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  opt.is_correct
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'text-[var(--color-text-secondary)]'
                }`}>
                  <span className="font-bold text-[10px] shrink-0">
                    {String.fromCharCode(65 + i)})
                  </span>
                  <span className="truncate">{opt.text}</span>
                  {opt.is_correct && <span className="ml-auto text-green-600 shrink-0">✓</span>}
                </div>
              ))}
            </div>
          )}
          {preview.type === 'matching' && preview.pairs && (
            <div className="space-y-1">
              {preview.pairs.map((pair, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 text-xs">
                  <span className="truncate text-[var(--color-text-primary)] font-medium">{pair.left}</span>
                  <span className="truncate text-[var(--color-text-muted)]">→ {pair.right}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
