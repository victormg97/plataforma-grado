'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { CellButton, type EstadoCell } from './CellButton';
import type { AlumnoResumenAnual } from '@/app/api/admin/pagos/resumen/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenPopup {
  alumnoId: string;
  mes: number;
}

export interface AlumnoRowProps {
  alumno: AlumnoResumenAnual;
  t: ReturnType<typeof useTranslations<'pagos'>>;
  openPopup: OpenPopup | null;
  onCellClick: (alumnoId: string, mes: number) => void;
  getButtonRef: (alumnoId: string, mes: number) => React.RefObject<HTMLButtonElement | null>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlumnoRow({
  alumno,
  t,
  openPopup,
  onCellClick,
  getButtonRef,
}: AlumnoRowProps) {
  const pagadosMeses = alumno.pagos.filter((p) => p.estado === 'pagado' || p.estado === 'parcial').length;
  const tasaMes = Math.round((pagadosMeses / 12) * 100);

  return (
    <tr className="group hover:bg-[var(--color-bg-secondary)] transition-colors">
      <td className="sticky left-0 z-10 bg-[var(--color-bg)] px-3 py-2 group-hover:bg-[var(--color-bg-secondary)] transition-colors">
        <span className="whitespace-nowrap text-sm font-medium text-[var(--color-text-primary)]">
          {alumno.nombre} {alumno.apellido}
        </span>
      </td>
      {alumno.pagos.map((pago) => {
        const ref = getButtonRef(alumno.alumno_id, pago.mes);
        const isOpen = openPopup?.alumnoId === alumno.alumno_id && openPopup?.mes === pago.mes;
        return (
          <td key={pago.mes} className="px-1 py-2">
            <div className="flex justify-center">
              <CellButton
                estado={pago.estado as EstadoCell}
                monto={pago.monto_pagado}
                mesLabel={t(`meses.${pago.mes}` as Parameters<typeof t>[0])}
                buttonRef={ref}
                isOpen={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  (ref as React.MutableRefObject<HTMLButtonElement | null>).current = e.currentTarget;
                  onCellClick(alumno.alumno_id, pago.mes);
                }}
              />
            </div>
          </td>
        );
      })}
      <td className="px-3 py-2 text-center">
        <span
          className={cn(
            'text-xs font-semibold',
            tasaMes >= 80 ? 'text-[var(--color-success)]' : tasaMes >= 50 ? 'text-[var(--color-partial)]' : 'text-[var(--color-text-muted)]'
          )}
        >
          {tasaMes}%
        </span>
      </td>
    </tr>
  );
}
