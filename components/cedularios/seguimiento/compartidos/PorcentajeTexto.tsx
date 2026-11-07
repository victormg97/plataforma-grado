'use client';

/**
 * Percentage text of the tracking: an em dash when there is nothing assigned,
 * otherwise 'NN %'. Never renders NaN or '0 %' for an empty assignment.
 */

import { cn } from '@/lib/utils';
import { esAvanceCompleto, formatearPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';

interface PorcentajeTextoProps {
  /** Rounded percentage (0 to 100) or null when there are no assigned materias. */
  porcentaje: number | null;
  className?: string;
}

export function PorcentajeTexto({ porcentaje, className }: PorcentajeTextoProps) {
  return (
    <span
      className={cn(
        'tabular-nums',
        esAvanceCompleto(porcentaje)
          ? 'font-semibold text-[var(--color-brand-gold)]'
          : 'text-[var(--color-text-primary)]',
        className,
      )}
    >
      {formatearPorcentaje(porcentaje)}
    </span>
  );
}
