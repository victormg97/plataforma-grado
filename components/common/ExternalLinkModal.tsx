'use client';

import { ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExternalLinkModalProps {
  /** The URL to open */
  url: string;
  /** Optional display title shown above the URL */
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content rendered between the URL box and the footer (e.g. trust checkbox) */
  children?: React.ReactNode;
}

export function ExternalLinkModal({
  url,
  title,
  onConfirm,
  onCancel,
  children,
}: ExternalLinkModalProps) {
  const t = useTranslations('common');

  // Show full URL but break long ones gracefully
  const displayUrl = url.length > 80 ? url.slice(0, 77) + '…' : url;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-100"
        role="presentation"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 sm:max-w-sm animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-brand-gold-muted)]">
                <ExternalLink className="size-4 text-[var(--color-brand-gold)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t('enlace_externo_titulo')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 px-4 pb-3">
            {title && (
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
            )}
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t('enlace_externo_desc')}
            </p>

            {/* URL box */}
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
              <ExternalLink className="size-3.5 shrink-0 mt-0.5 text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)] font-mono break-all">
                {displayUrl}
              </span>
            </div>

            {/* Slot for extra content (e.g. trust checkbox in notas) */}
            {children}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('cancelar')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex items-center gap-1.5 h-8 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="size-3.5" />
              {t('enlace_externo_abrir')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
