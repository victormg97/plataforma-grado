'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, Info, Loader2, X } from 'lucide-react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

async function fetchReferralTerms(): Promise<string> {
  const res = await fetch('/api/legal/referidos-terminos');
  if (!res.ok) throw new Error('TERMS_FETCH_FAILED');
  const data = await res.json();
  if (typeof data?.content !== 'string' || !data.content.trim()) {
    throw new Error('TERMS_EMPTY');
  }
  return data.content as string;
}

// ── Modal ────────────────────────────────────────────────────────────────────

interface TerminosReferidosModalProps {
  open: boolean;
  onClose: () => void;
  /** Título del modal. Por defecto: `referidos.terminos_titulo`. */
  title?: string;
}

export function TerminosReferidosModal({
  open,
  onClose,
  title,
}: TerminosReferidosModalProps) {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');

  // El contenido solo se pide la primera vez que se abre el modal.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: fetchReferralTerms,
    staleTime: 10 * 60_000,
    retry: false,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // El portal necesita el DOM: en el servidor no se renderiza nada. El modal
  // solo puede abrirse tras una interacción del usuario, así que en el primer
  // render del cliente el portal está vacío y no hay desajuste de hidratación.
  if (typeof document === 'undefined') return null;

  const heading = title || t('terminos_titulo');

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
          />

          <m.div
            key="panel"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={heading}
            className="fixed inset-x-3 bottom-3 top-[6vh] z-[9999] mx-auto flex max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] sm:inset-x-auto sm:bottom-[6vh] sm:left-1/2 sm:w-[min(42rem,calc(100vw-2rem))] sm:-translate-x-1/2"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
              <h2
                className="text-base font-semibold text-[var(--color-text-primary)] sm:text-lg"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {heading}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={tc('cerrar')}
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="size-6 animate-spin text-[var(--color-brand-gold)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t('terminos_cargando')}
                  </p>
                </div>
              )}

              {isError && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <AlertCircle className="size-6 text-[var(--color-error)]" />
                  <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
                    {t('terminos_error')}
                  </p>
                </div>
              )}

              {data && <MarkdownRenderer content={data} />}
            </div>

            <footer className="shrink-0 border-t border-[var(--color-border)] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {tc('cerrar')}
              </button>
            </footer>
          </m.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Botón (i) que abre el modal ──────────────────────────────────────────────

interface TerminosReferidosButtonProps {
  /** Título que se muestra en el encabezado del modal. */
  title?: string;
  className?: string;
}

/**
 * Botón de información (i) que abre los Términos y Condiciones del programa de
 * referidos del tenant activo. Gestiona su propio estado, así que basta con
 * colocarlo junto al texto de la nota legal.
 */
export function TerminosReferidosButton({
  title,
  className,
}: TerminosReferidosButtonProps) {
  const t = useTranslations('referidos');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('terminos_boton')}
        title={t('terminos_boton')}
        className={[
          // Sin borde propio: el icono de lucide ya dibuja su círculo.
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--color-brand-gold)] transition-colors',
          'hover:bg-[var(--color-brand-gold-muted)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          className || '',
        ].join(' ')}
      >
        <Info className="size-[1.15rem]" />
      </button>

      <TerminosReferidosModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
      />
    </>
  );
}
