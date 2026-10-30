import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { WeeklyCaseStatus } from '@/lib/comunidad/weekly-case';

const STAMP_TONE: Record<WeeklyCaseStatus, string> = {
  draft: 'var(--game-stamp-closed)',
  open: 'var(--game-stamp-open)',
  closed: 'var(--game-stamp-closed)',
  resolved: 'var(--game-stamp-resolved)',
};

/**
 * Status of a weekly case.
 *  - pill:  compact chip for lists.
 *  - stamp: tilted rubber stamp for the case file header.
 */
export function CaseStatusBadge({
  status,
  variant = 'pill',
}: {
  status: WeeklyCaseStatus;
  variant?: 'pill' | 'stamp';
}) {
  const t = useTranslations('comunidadEstrategica');
  const tone = STAMP_TONE[status];

  if (variant === 'stamp') {
    return (
      <span
        className="inline-flex -rotate-6 select-none items-center rounded-md border-[3px] border-double px-3 py-1 text-sm font-black uppercase tracking-[0.18em] opacity-90"
        style={{ color: tone, borderColor: tone }}
      >
        {t(`weekly_case_status_${status}`)}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide')}
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {t(`weekly_case_status_${status}`)}
    </span>
  );
}
