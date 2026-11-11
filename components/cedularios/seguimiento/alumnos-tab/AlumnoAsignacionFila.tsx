'use client';

/**
 * One student row of the "Alumnos" tab of a cedulario (Req 16.2, 16.7, 16.8, 16.9).
 * Shows avatar, name, percentage with a progress bar, assignment date and last activity date.
 * "Revisar" opens the reviewer through `useSegUrl`. "Desasignar" is rendered only when the
 * server says the current user can write this student (`puedeEditar`), so an observer
 * professor only sees "Revisar".
 */

import { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import type { AlumnoDeCedulario } from '@/lib/queries/cedularios/seguimiento/resumen';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';
import { RolAsignatarioBadge } from '../compartidos/RolAsignatarioBadge';
import { DesasignarDialog } from '../asignacion/DesasignarDialog';
import { useSegUrl } from '../url/useSegUrl';

export interface AlumnoAsignacionFilaProps {
  alumno: AlumnoDeCedulario;
  cedularioId: string;
  cedularioNombre: string;
}

function formatearFecha(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = parseISO(iso);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy', { locale: es }) : null;
}

export function AlumnoAsignacionFila({
  alumno,
  cedularioId,
  cedularioNombre,
}: AlumnoAsignacionFilaProps) {
  const t = useTranslations('cedularios.seguimiento');
  const { abrir } = useSegUrl();
  const [confirmando, setConfirmando] = useState(false);

  const nombreCompleto = [alumno.nombre, alumno.apellido]
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
    .join(' ');
  const nombreVisible = nombreCompleto !== '' ? nombreCompleto : t('comun.alumno_sin_nombre');

  const asignadoEl = formatearFecha(alumno.asignadoAt);
  const actividadEl = formatearFecha(alumno.ultimaActividad);

  const revisar = () => {
    abrir({ modal: 'revision', alumno: alumno.alumnoId, cedulario: cedularioId });
  };

  return (
    <li className="flex flex-col gap-3 p-[var(--space-sm)] sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          nombre={alumno.nombre}
          apellido={alumno.apellido}
          avatarUrl={alumno.avatarUrl}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {nombreVisible}
            </span>
            <RolAsignatarioBadge rol={alumno.rol} />
            {!alumno.alumnoActivo && (
              <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {t('comun.inactivo')}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{alumno.email}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-text-muted)]">
            {asignadoEl && <span>{t('alumnos_tab.asignado_el', { fecha: asignadoEl })}</span>}
            <span>
              {actividadEl
                ? t('alumnos_tab.actividad_el', { fecha: actividadEl })
                : t('alumnos_tab.sin_actividad')}
            </span>
          </p>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-48 sm:shrink-0">
        <ProgresoBarra porcentaje={alumno.porcentaje} tamano="sm" className="flex-1" />
        <PorcentajeTexto
          porcentaje={alumno.porcentaje}
          className="w-12 shrink-0 text-right text-sm font-medium"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={revisar}
          aria-label={t('alumnos_tab.revisar_aria', { alumno: nombreVisible })}
        >
          {t('alumnos_tab.revisar')}
        </Button>
        {alumno.puedeEditar && (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmando(true)}
              aria-label={t('alumnos_tab.desasignar_aria', { alumno: nombreVisible })}
            >
              {t('alumnos_tab.desasignar')}
            </Button>
            <DesasignarDialog
              open={confirmando}
              onClose={() => setConfirmando(false)}
              asignacionId={alumno.asignacionId}
              alumnoId={alumno.alumnoId}
              cedularioId={cedularioId}
              cedularioNombre={cedularioNombre}
              alumnoNombre={nombreVisible}
              materiasCubiertas={alumno.totalCubiertas}
            />
          </>
        )}
      </div>
    </li>
  );
}
