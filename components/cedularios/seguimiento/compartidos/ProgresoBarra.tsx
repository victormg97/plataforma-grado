'use client';

/**
 * Progress bar of the tracking. Uses the brand gold at 100 % and the success
 * color otherwise. With a null percentage (nothing assigned) the bar is empty
 * and exposes no value to assistive technology.
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { esAvanceCompleto, formatearPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';

interface ProgresoBarraProps {
  /** Rounded percentage (0 to 100) or null when there are no assigned materias. */
  porcentaje: number | null;
  /** Visual height of the bar. */
  tamano?: 'sm' | 'md';
  className?: string;
}

export function ProgresoBarra({ porcentaje, tamano = 'md', className }: ProgresoBarraProps) {
  const t = useTranslations('cedularios.seguimiento');
  const completo = esAvanceCompleto(porcentaje);
  const ancho = porcentaje === null ? 0 : Math.min(100, Math.max(0, porcentaje));

  return (
    <div
      role="progressbar"
      aria-label={t('comun.avance_aria', { porcentaje: formatearPorcentaje(porcentaje) })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje ?? undefined}
      className={cn(
        'w-full overflow-hidden rounded-full bg-[var(--color-border)]',
        tamano === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
          completo ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-success)]',
        )}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}
