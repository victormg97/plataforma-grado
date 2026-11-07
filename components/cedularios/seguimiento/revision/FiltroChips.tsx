'use client';

/**
 * Filter chips of the Revisor tree: All, Pending, Covered, Reviewed.
 * Controlled component: the parent writes the choice to `seg_filtro` through `useSegUrl`.
 */

import { useTranslations } from 'next-intl';
import { SEG_FILTROS } from '@/lib/cedularios/seguimiento/url';
import type { SegFiltro } from '@/lib/cedularios/seguimiento/filtros';
import { cn } from '@/lib/utils';

interface FiltroChipsProps {
  value: SegFiltro;
  onChange: (filtro: SegFiltro) => void;
  disabled?: boolean;
  className?: string;
}

export function FiltroChips({ value, onChange, disabled = false, className }: FiltroChipsProps) {
  const t = useTranslations('cedularios.seguimiento.revision');

  return (
    <div
      role="group"
      aria-label={t('filtros_aria')}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {SEG_FILTROS.map((filtro) => {
        const activo = filtro === value;
        return (
          <button
            key={filtro}
            type="button"
            aria-pressed={activo}
            disabled={disabled}
            onClick={() => {
              if (!activo) onChange(filtro);
            }}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
              'disabled:pointer-events-none disabled:opacity-50',
              activo
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] font-medium text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {t(`filtros.${filtro}`)}
          </button>
        );
      })}
    </div>
  );
}
