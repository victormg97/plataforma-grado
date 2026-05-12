import { FileX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
          <FileX className="size-8 text-[var(--color-brand-gold)]" />
        </div>
        <h1
          className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Página no encontrada
        </h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">
          La página que buscas no existe o fue movida.
        </p>
        <a
          href="/login"
          className="inline-block rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-6 py-2.5 text-sm font-medium text-[var(--color-brand-black)] transition-colors hover:bg-[var(--color-brand-gold-hover)]"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
