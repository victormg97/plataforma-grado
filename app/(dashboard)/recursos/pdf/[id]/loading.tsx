export default function PDFLoading() {
  return (
    <div className="-mt-2 -mb-[var(--container-padding)]">
      <div className="flex h-[calc(100dvh-5.5rem)] items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Cargando documento…</p>
        </div>
      </div>
    </div>
  );
}
