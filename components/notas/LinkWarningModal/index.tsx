'use client';

import { useState } from 'react';
import { ExternalLink, X, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

type LinkWarningModalProps = {
  url: string;
  authorName: string;
  authorId: string;
  authorRole: string;
  onConfirm: (trust: boolean) => void;
  onCancel: () => void;
};

export function LinkWarningModal({
  url,
  authorName,
  authorRole,
  onConfirm,
  onCancel,
}: LinkWarningModalProps) {
  const t = useTranslations('notas');
  const [trust, setTrust] = useState(false);

  // Truncate long URLs for display
  const displayUrl = url.length > 60 ? url.slice(0, 57) + '…' : url;
  const isProfesor = authorRole === 'profesor';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-100"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 sm:max-w-sm animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary,var(--background))] shadow-lg overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-base font-semibold font-[family-name:var(--font-display)] text-[var(--color-text-primary)]">
                {t('advertencia_enlace_titulo')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 px-4 pb-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t('advertencia_enlace_desc')}
            </p>

            {/* URL box */}
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)] font-mono break-all">
                {displayUrl}
              </span>
            </div>

            {/* Trust checkbox — only for profesor-authored links */}
            {isProfesor && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trust}
                  onChange={(e) => setTrust(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand-gold)] cursor-pointer"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  {t('advertencia_enlace_confiar', { nombre: authorName })}
                </span>
              </label>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('cancelar')}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(trust)}
              className="flex items-center gap-1.5 h-8 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('advertencia_enlace_abrir')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
