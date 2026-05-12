'use client';

// ─── Component ────────────────────────────────────────────────────────────────

export function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="flex flex-1 gap-1 justify-around">
            {Array.from({ length: 12 }).map((_, j) => (
              <div key={j} className="size-8 animate-pulse rounded-full bg-[var(--color-bg-secondary)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
