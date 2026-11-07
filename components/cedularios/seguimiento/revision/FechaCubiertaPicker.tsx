'use client';

/**
 * Covered date of a materia. Edit mode: a native date input capped at today
 * (platform time zone). Read mode: plain text. Renders nothing without a date.
 */

import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { esFechaFutura, hoyEnChile } from '@/lib/cedularios/seguimiento/fechas';

interface FechaCubiertaPickerProps {
  /** Covered date as 'yyyy-MM-dd', or null when the materia is pending. */
  value: string | null;
  /** Display name of the materia, used in the accessible label. */
  materia: string;
  /** True in edit mode; false renders plain text. */
  editable: boolean;
  /** Called with a valid 'yyyy-MM-dd' date that is not later than today. */
  onChange?: (fecha: string) => void;
  /** Disables the input while a save is in flight. */
  disabled?: boolean;
  /** Makes the input a tab stop. Default false (the tree manages focus). */
  focusable?: boolean;
  className?: string;
}

function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : valor;
}

export function FechaCubiertaPicker({
  value,
  materia,
  editable,
  onChange,
  disabled = false,
  focusable = false,
  className,
}: FechaCubiertaPickerProps) {
  const t = useTranslations('cedularios.seguimiento.revision.fila');

  if (!value) return null;

  if (!editable) {
    return (
      <span className={cn('text-xs text-[var(--color-text-muted)]', className)}>
        {t('cubierta_el', { fecha: formatearFecha(value) })}
      </span>
    );
  }

  const hoy = hoyEnChile();

  const manejarCambio = (e: ChangeEvent<HTMLInputElement>) => {
    const siguiente = e.target.value;
    // An empty value means the user cleared the field; the date stays unchanged.
    if (!siguiente || siguiente === value || esFechaFutura(siguiente, hoy)) return;
    onChange?.(siguiente);
  };

  // Keep row-level handlers (open detail, toggle on Space, tree arrows) out of the input.
  const detener = (e: MouseEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  return (
    <input
      type="date"
      value={value}
      max={hoy}
      disabled={disabled}
      onChange={manejarCambio}
      onClick={detener}
      onKeyDown={detener}
      aria-label={t('fecha_aria', { materia })}
      title={t('fecha_max')}
      tabIndex={focusable ? 0 : -1}
      className={cn(
        'h-7 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 text-xs text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:opacity-50',
        className,
      )}
    />
  );
}
