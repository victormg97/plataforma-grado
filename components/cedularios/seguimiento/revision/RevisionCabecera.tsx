'use client';

/**
 * Header of the reviewer: cedulario (with switcher when the student has two or
 * more active assignments), university, student avatar and name, global
 * percentage with a progress bar, and a notice for inactive assignments.
 * Presentational: data comes from `useResumenAlumno` through the parent.
 */

import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import type {
  AsignacionResumen,
  ResumenAlumno,
} from '@/lib/queries/cedularios/seguimiento/resumen';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';
import { CedularioSelector } from './CedularioSelector';

interface RevisionCabeceraProps {
  resumen: ResumenAlumno;
  /** Assignment open in the reviewer. */
  asignacion: AsignacionResumen;
  className?: string;
}

function formatearFecha(iso: string): string | null {
  const fecha = parseISO(iso);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy', { locale: es }) : null;
}

export function RevisionCabecera({ resumen, asignacion, className }: RevisionCabeceraProps) {
  const t = useTranslations('cedularios.seguimiento');
  const { alumno } = resumen;

  const nombreCompleto = [alumno.nombre, alumno.apellido, alumno.apellidoMaterno]
    .filter((parte): parte is string => Boolean(parte && parte.trim()))
    .join(' ');
  const asignadoEl = asignacion.asignadoAt ? formatearFecha(asignacion.asignadoAt) : null;
  const inactiva = asignacion.estado === 'desasignada';

  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <CedularioSelector
            asignaciones={resumen.asignaciones}
            cedularioId={asignacion.cedularioId}
          />
          {asignacion.universidadNombre && (
            <p className="truncate text-sm text-[var(--color-text-muted)]">
              {t('revision.cabecera.universidad', { nombre: asignacion.universidadNombre })}
            </p>
          )}
          {asignadoEl && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('revision.cabecera.asignado_el', { fecha: asignadoEl })}
            </p>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            nombre={alumno.nombre}
            apellido={alumno.apellido}
            avatarUrl={alumno.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-text-muted)]">{t('revision.cabecera.alumno')}</p>
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {nombreCompleto || t('comun.alumno_sin_nombre')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('revision.cabecera.avance_global')}
          </span>
          <span className="flex items-baseline gap-2 text-sm text-[var(--color-text-muted)]">
            <span>
              {t('revision.cabecera.materias_cubiertas', {
                cubiertas: asignacion.totalCubiertas,
                total: asignacion.totalAsignadas,
              })}
            </span>
            <PorcentajeTexto porcentaje={asignacion.porcentaje} className="text-base font-semibold" />
          </span>
        </div>
        <ProgresoBarra porcentaje={asignacion.porcentaje} />
      </div>

      {inactiva && (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        >
          {t('revision.cabecera.inactiva_aviso')}
        </p>
      )}
    </header>
  );
}
