'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
          <AlertTriangle className="h-8 w-8 text-[var(--color-error)]" />
        </div>
        <h1
          className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Algo salió mal
        </h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            Intentar de nuevo
          </button>
          <a
            href="/login"
            className="rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-6 py-2.5 text-sm font-medium text-[var(--color-brand-black)] transition-colors hover:bg-[var(--color-brand-gold-hover)]"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
