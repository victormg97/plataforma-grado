'use client';

/**
 * Card of one cedulario assignment in the student record section.
 *
 * - Active assignment: name, university, progress bar with percentage, "N of M materias",
 *   "Revisar" and, when the user can edit, "Desasignar" (confirmation dialog).
 * - Unassigned assignment (history): name, university, unassigned date and, when the user can
 *   reassign, "Reasignar". The progress is kept by the server, so only the totals are shown.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { PLATFORM_TIMEZONE } from '@/lib/cedularios/seguimiento/constants';
import type { AsignacionResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import { DesasignarDialog } from '../asignacion/DesasignarDialog';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';

export interface AsignacionCardProps {
  asignacion: AsignacionResumen;
  alumnoId: string;
  /** Full name of the student, shown in the unassign confirmation. */
  alumnoNombre: string;
  /** The user can write the tracking of this student (shows "Desasignar"). */
  puedeEditar: boolean;
  /** The user can assign to this student (active student and can edit): shows "Reasignar". */
  puedeAsignar: boolean;
  /** Opens the reviewer on this cedulario. */
  onRevisar: (cedularioId: string) => void;
  /** Opens the assign dialog with student and cedulario fixed. Unassigned cards only. */
  onReasignar?: (cedularioId: string) => void;
}

function formatearFecha(iso: string | null, locale: string): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: PLATFORM_TIMEZONE }).format(
    fecha,
  );
}

export function AsignacionCard({
  asignacion,
  alumnoId,
  alumnoNombre,
  puedeEditar,
  puedeAsignar,
  onRevisar,
  onReasignar,
}: AsignacionCardProps) {
  const t = useTranslations('cedularios.seguimiento.ficha');
  const tErrores = useTranslations('cedularios.errores');
  const locale = useLocale();
  const [confirmando, setConfirmando] = useState(false);

  const activa = asignacion.estado === 'activa';
  const nombre = asignacion.cedularioNombre;

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{nombre}</p>
          {asignacion.universidadNombre && (
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {t('universidad', { nombre: asignacion.universidadNombre })}
            </p>
          )}
        </div>
        {!activa && asignacion.desasignadoAt && (
          <p className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {t('desasignado_el', { fecha: formatearFecha(asignacion.desasignadoAt, locale) })}
          </p>
        )}
      </div>

      {activa ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--color-text-muted)]">
              {t('materias_progreso', {
                cubiertas: asignacion.totalCubiertas,
                total: asignacion.totalAsignadas,
              })}
            </span>
            <PorcentajeTexto porcentaje={asignacion.porcentaje} className="text-sm font-medium" />
          </div>
          <ProgresoBarra porcentaje={asignacion.porcentaje} />
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('materias_progreso', {
            cubiertas: asignacion.totalCubiertas,
            total: asignacion.totalAsignadas,
          })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {activa && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => onRevisar(asignacion.cedularioId)}
              aria-label={t('revisar_aria', { cedulario: nombre })}
            >
              {t('revisar')}
            </Button>
            {puedeEditar && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmando(true)}
                aria-label={t('desasignar_aria', { cedulario: nombre })}
              >
                {t('desasignar')}
              </Button>
            )}
          </>
        )}
        {!activa && puedeAsignar && onReasignar && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!asignacion.cedularioActivo}
            title={asignacion.cedularioActivo ? undefined : tErrores('cedulario_no_disponible')}
            onClick={() => onReasignar(asignacion.cedularioId)}
          >
            {t('reasignar')}
          </Button>
        )}
      </div>

      {activa && puedeEditar && (
        <DesasignarDialog
          open={confirmando}
          onClose={() => setConfirmando(false)}
          asignacionId={asignacion.asignacionId}
          alumnoId={alumnoId}
          cedularioId={asignacion.cedularioId}
          cedularioNombre={nombre}
          alumnoNombre={alumnoNombre}
          materiasCubiertas={asignacion.totalCubiertas}
        />
      )}
    </li>
  );
}
