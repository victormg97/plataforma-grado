export default function LandingLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Hero section skeleton */}
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="h-12 w-96 max-w-full rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="mt-4 h-6 w-80 max-w-full rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
        <div className="mt-8 h-12 w-48 rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]" />
      </div>

      {/* Section skeleton */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
