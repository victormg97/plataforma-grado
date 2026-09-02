import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { WeeklyCaseStatus } from '@/lib/comunidad/weekly-case';

/** Small status pill for a weekly case, styled with the game tokens. */
export function CaseStatusBadge({ status }: { status: WeeklyCaseStatus }) {
  const t = useTranslations('comunidadEstrategica');

  const styleFor: Record<WeeklyCaseStatus, string> = {
    draft: 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]',
    open: 'bg-[var(--game-accent)] text-[var(--game-on-accent)]',
    closed: 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]',
    resolved: 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]',
  };

  return (
    <span
      className={cn(
        'w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        styleFor[status]
      )}
    >
      {t(`weekly_case_status_${status}`)}
    </span>
  );
}
