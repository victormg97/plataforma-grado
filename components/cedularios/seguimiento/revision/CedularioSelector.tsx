'use client';

/**
 * Cedulario switcher of the reviewer. With two or more active assignments (and
 * the open one among them) it shows a select with each cedulario name and its
 * percentage; picking one writes `seg_cedulario` and clears `seg_materia`
 * without closing the reviewer. With a single assignment it shows fixed text.
 */

import { useId, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import { cn } from '@/lib/utils';
import { formatearPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';
import type { AsignacionResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import { useSegUrl } from '../url/useSegUrl';

interface CedularioSelectorProps {
  /** Assignments of the student (any state; only the active ones are offered). */
  asignaciones: AsignacionResumen[];
  /** Cedulario currently open in the reviewer. */
  cedularioId: string;
  className?: string;
}

export function CedularioSelector({ asignaciones, cedularioId, className }: CedularioSelectorProps) {
  const t = useTranslations('cedularios.seguimiento.revision.selector');
  const { fijar } = useSegUrl();
  const selectId = useId();

  const activas = useMemo(
    () => asignaciones.filter((asignacion) => asignacion.estado === 'activa'),
    [asignaciones],
  );
  const actual = asignaciones.find((asignacion) => asignacion.cedularioId === cedularioId);

  const opciones = useMemo(
    () =>
      activas.map((asignacion) => ({
        value: asignacion.cedularioId,
        label: t('opcion', {
          nombre: asignacion.cedularioNombre,
          porcentaje: formatearPorcentaje(asignacion.porcentaje),
        }),
      })),
    [activas, t],
  );

  const hayVarias = activas.length >= 2 && activas.some((a) => a.cedularioId === cedularioId);

  if (!hayVarias) {
    // Single assignment (or the open one is inactive): fixed text, no selector.
    return (
      <p className={cn('truncate text-base font-semibold text-[var(--color-text-primary)]', className)}>
        {actual?.cedularioNombre ?? ''}
      </p>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={selectId} className="sr-only">
        {t('aria')}
      </label>
      <AppSelect
        id={selectId}
        value={cedularioId}
        options={opciones}
        onChange={(valor) => {
          if (valor === cedularioId) return;
          fijar({ cedulario: valor, materia: null });
        }}
        className="w-full max-w-full font-semibold"
      />
    </div>
  );
}
