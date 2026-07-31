export default function RecursosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="h-4 w-64 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="h-10 w-32 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="ml-auto h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]" />
        ))}
      </div>
    </div>
  );
}
