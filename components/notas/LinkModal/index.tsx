'use client';

import { useState, useRef, useEffect } from 'react';
import { Link, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type LinkModalProps = {
  onClose: () => void;
  onConfirm: (href: string, text: string) => void;
  initialUrl?: string;
  initialText?: string;
};

export function LinkModal({ onClose, onConfirm, initialUrl = '', initialText = '' }: LinkModalProps) {
  const t = useTranslations('notas');
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus URL input on mount
    urlRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError(t('enlace_url_requerida'));
      return;
    }

    // Validate URL
    const href = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`;
    try {
      new URL(href);
    } catch {
      setError(t('enlace_url_invalida'));
      return;
    }

    onConfirm(href, text.trim());
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-in fade-in-0 duration-100"
        role="presentation"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 sm:max-w-sm animate-in fade-in-0 zoom-in-95 duration-100">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary,var(--background))] shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-brand-gold-muted)]">
                <Link className="size-4 text-[var(--color-brand-gold)]" />
              </div>
              <h3 className="text-base font-medium font-[family-name:var(--font-display)] text-[var(--color-text-primary)]">
                {t('insertar_enlace')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="link-text" className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('enlace_texto')}
              </label>
              <input
                id="link-text"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('enlace_texto_placeholder')}
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="link-url" className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('enlace_url')}
              </label>
              <input
                ref={urlRef}
                id="link-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError('');
                }}
                placeholder="https://ejemplo.com"
                className={`h-9 w-full rounded-lg border bg-transparent px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/30'
                    : 'border-[var(--color-border)] focus:border-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]/30'
                }`}
              />
              {error && (
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-sm)]"
            >
              {t('cancelar')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {t('enlace_insertar')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
