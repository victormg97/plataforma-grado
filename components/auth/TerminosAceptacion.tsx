'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Modal de Términos y Condiciones ──────────────────────────────────────────

function TerminosModal({
  open,
  onClose,
  content,
  title,
}: {
  open: boolean;
  onClose: () => void;
  content: string;
  title: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-4 bottom-0 top-[5vh] z-50 mx-auto flex max-w-lg flex-col rounded-t-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:rounded-[var(--radius-lg)] sm:top-[5vh] sm:bottom-[5vh] sm:w-full"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 shrink-0">
              <h2
                className="text-base font-semibold text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-6 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-4 mb-1">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-[var(--color-text-secondary)]">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-[var(--color-text-secondary)]">{children}</ol>
                  ),
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-gold)] underline underline-offset-2 hover:opacity-80 transition-opacity">{children}</a>
                  ),
                  hr: () => <hr className="border-[var(--color-border)] my-4" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-[var(--color-bg-secondary)]">{children}</thead>,
                  th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 text-[var(--color-text-secondary)] border border-[var(--color-border)]">{children}</td>,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Bloque de aceptación (checkbox + enlace + modal) ──────────────────────────

interface TerminosAceptacionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta antes del enlace, p. ej. "He leído y acepto los". */
  label: string;
  /** Texto del enlace, p. ej. "Términos y Condiciones". */
  linkLabel: string;
  /** Mensaje de error opcional si el tenant no tiene T&C configurados. */
  sinContenidoError?: string;
}

/**
 * Bloque reutilizable de aceptación de Términos y Condiciones. Precarga el
 * contenido desde `/api/legal/terminos` y lo muestra en un modal superpuesto.
 * Usado por la vista de setup y por la vista pública de registro.
 */
export function TerminosAceptacion({
  checked,
  onChange,
  label,
  linkLabel,
  sinContenidoError,
}: TerminosAceptacionProps) {
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/legal/terminos')
      .then((r) => r.json())
      .then((d) => {
        if (d.content) setContent(d.content);
      })
      .catch(() => {
        /* silencioso — fallback al abrir */
      });
  }, []);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (content) {
      setShowModal(true);
      setError(null);
    } else if (sinContenidoError) {
      setError(sinContenidoError);
    } else {
      window.open('/terminos', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <TerminosModal
        open={showModal}
        onClose={() => setShowModal(false)}
        content={content}
        title={linkLabel}
      />

      <label
        htmlFor="accept-terms"
        className={`flex items-start gap-3 cursor-pointer rounded-[var(--radius-md)] border p-3 transition-colors ${
          checked
            ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
            : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-brand-gold)]/50'
        }`}
      >
        <input
          id="accept-terms"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-[var(--color-border)] accent-[var(--color-brand-gold)] cursor-pointer"
        />
        <span className="text-sm text-[var(--color-text-secondary)] leading-snug">
          {label}{' '}
          <button
            type="button"
            onClick={handleOpen}
            className="font-medium text-[var(--color-brand-gold)] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {linkLabel}
          </button>
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
    </>
  );
}
