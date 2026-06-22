'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface LastAccessBadgeProps {
  dateStr?: string | null;
}

/**
 * Shows the last access time in a human-friendly compact format.
 * - < 7 days: relative (e.g. "hace 2 días")
 * - >= 7 days: short date (e.g. "16 jun")
 * - null: dash
 */
export function LastAccessBadge({ dateStr }: LastAccessBadgeProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  if (!dateStr) {
    return <span className="text-[var(--color-text-muted)]">—</span>;
  }

  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = differenceInDays(now, date);

  let text: string;
  if (daysDiff < 1) {
    text = t('hoy');
  } else if (daysDiff < 7) {
    text = formatDistanceToNow(date, { addSuffix: true, locale: dateFnsLocale });
  } else {
    text = format(date, locale === 'en' ? 'MMM d' : "d MMM", { locale: dateFnsLocale });
  }

  // Color hint: green if recent (<3 days), muted if old (>30 days), default otherwise
  const colorClass =
    daysDiff <= 3
      ? 'text-[var(--color-success)]'
      : daysDiff > 30
      ? 'text-[var(--color-text-muted)]'
      : 'text-[var(--color-text-secondary)]';

  return (
    <span className={`text-xs whitespace-nowrap ${colorClass}`} title={format(date, 'PPpp', { locale: dateFnsLocale })}>
      {text}
    </span>
  );
}
