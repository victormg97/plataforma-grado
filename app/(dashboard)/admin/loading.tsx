export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="h-4 w-72 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-[var(--space-md)] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]" />
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-2">
        <div className="h-64 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]" />
        <div className="h-64 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]" />
      </div>
    </div>
  );
}
