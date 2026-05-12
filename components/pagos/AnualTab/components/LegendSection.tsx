'use client';

import { useTranslations } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegendSectionProps {
  t: ReturnType<typeof useTranslations<'pagos'>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegendSection({ t }: LegendSectionProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
      <div className="flex items-center gap-1.5">
        <div className="flex size-5 items-center justify-center rounded-full bg-[var(--color-success)] text-[9px] font-bold text-white">✓</div>
        <span>{t('anual_leyenda_pagado')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex size-5 items-center justify-center rounded-full bg-[var(--color-partial)] text-[9px] font-bold text-white">½</div>
        <span>{t('anual_leyenda_parcial')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-5 rounded-full border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]" />
        <span>{t('anual_leyenda_pendiente')}</span>
      </div>
    </div>
  );
}
