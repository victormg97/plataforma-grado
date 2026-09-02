'use client';

/**
 * Simple progress bar for a challenge: progress_count / target_count.
 */
export function ChallengeProgressBar({
  progress,
  target,
}: {
  progress: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(Math.round((progress / target) * 100), 100) : 0;

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--game-surface-muted)]"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={target}
    >
      <div
        className="h-full rounded-full bg-[var(--game-accent)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
