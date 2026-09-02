'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { subMonths, format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { AppSelect } from '@/components/common/AppSelect';

/**
 * Lets the player pick the current month or a previous one to view the
 * historical ranking (Req. 6.2). Value is a 'YYYY-MM' string; null = current.
 */
export function MonthSelector({
  value,
  onChange,
  monthsBack = 11,
}: {
  value: string | null;
  onChange: (month: string | null) => void;
  monthsBack?: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;

  const options = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i <= monthsBack; i++) {
      const d = subMonths(now, i);
      const val = format(d, 'yyyy-MM');
      const label = i === 0 ? t('ranking_month_current') : format(d, 'LLLL yyyy', { locale: dfLocale });
      opts.push({ value: val, label });
    }
    return opts;
  }, [monthsBack, t, dfLocale]);

  // The first option (current month) maps to null so the RPC uses "now".
  const currentValue = value ?? options[0]?.value ?? '';

  return (
    <AppSelect
      value={currentValue}
      onChange={(v) => onChange(v === options[0]?.value ? null : v)}
      options={options}
      placeholder={t('ranking_month_label')}
    />
  );
}
