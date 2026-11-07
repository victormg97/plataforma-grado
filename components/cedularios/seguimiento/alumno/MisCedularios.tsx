'use client';

/**
 * "Mis cedularios": read-only view of the student (Req 24).
 *
 * Lists the active assignments of the signed-in student with cedulario name, university and
 * progress. Choosing one writes `seg_cedulario` and shows the Revisor embedded in read mode
 * (`variante="embebida"`, `modo="lectura"`): filters, search and tree expansion only, with no
 * write actions, no "Actividad" tab and no archived / deactivated sections.
 *
 * Security
 * - Queries only use the session user id. RLS returns zero rows for anything else, so a
 *   hand-edited `seg_cedulario` that is not in the list shows the "not available" message
 *   and the Revisor is never mounted for it.
 * - The Revisor is imported through its lazy wrapper, so its code stays out of the page bundle
 *   until the student picks a cedulario.
 */

import { useCallback, useMemo } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { AsignacionResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegRol } from '../hooks/useSegRol';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';
import { RevisionCedularioAlumnoLazy } from '../revision/RevisionCedularioAlumnoLazy';
import { useSegUrl } from '../url/useSegUrl';

interface MisCedulariosProps {
  className?: string;
}

export function MisCedularios({ className }: MisCedulariosProps) {
  const t = useTranslations('cedularios.seguimiento.alumno');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const { userId } = useSegRol();
  const { estado, fijar } = useSegUrl();

  // Only the session user id is used to query: never a value read from the URL.
  const resumenQuery = useResumenAlumno(userId);
  const resumen = resumenQuery.data ?? null;

  const activas = useMemo<AsignacionResumen[]>(
    () => (resumen ? resumen.asignaciones.filter((a) => a.estado === 'activa') : []),
    [resumen],
  );

  const seleccionada = useMemo(
    () => (estado.cedulario ? activas.find((a) => a.cedularioId === estado.cedulario) ?? null : null),
    [activas, estado.cedulario],
  );

  const abrir = useCallback(
    (cedularioId: string) => {
      fijar({ cedulario: cedularioId, materia: null, filtro: 'todas', q: '' });
    },
    [fijar],
  );

  const volver = useCallback(() => {
    fijar({ cedulario: null, materia: null, filtro: 'todas', q: '' });
  }, [fijar]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (userId === null || resumenQuery.isPending) {
    return (
      <section aria-label={t('titulo')} aria-busy="true" className={className}>
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--color-text-muted)]"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>{tComun('cargando')}</span>
        </div>
      </section>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (resumenQuery.isError && !resumen) {
    return (
      <section aria-label={t('titulo')} className={className}>
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
        >
          <p className="text-sm text-[var(--color-error)]">{t('error_carga')}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={resumenQuery.isFetching}
            onClick={() => void resumenQuery.refetch()}
          >
            {tComun('reintentar')}
          </Button>
        </div>
      </section>
    );
  }

  // ── Selected cedulario: embedded read-only reviewer ───────────────────────
  if (estado.cedulario !== null) {
    const botonVolver = (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<ArrowLeft className="size-4" aria-hidden="true" />}
        onClick={volver}
      >
        {t('volver')}
      </Button>
    );

    // The URL points to something that is not one of the student's active assignments.
    if (!seleccionada || !resumen) {
      return (
        <section aria-label={t('titulo')} className={cn('flex flex-col gap-4', className)}>
          <div>{botonVolver}</div>
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]"
          >
            {t('no_disponible')}
          </p>
        </section>
      );
    }

    return (
      <section aria-label={t('titulo')} className={cn('flex flex-col gap-4', className)}>
        <div>{botonVolver}</div>
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        >
          {t('solo_lectura')}
        </p>
        <RevisionCedularioAlumnoLazy
          alumnoId={resumen.alumno.id}
          cedularioId={seleccionada.cedularioId}
          modo="lectura"
          variante="embebida"
          onCerrar={volver}
        />
      </section>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (activas.length === 0) {
    return (
      <section aria-label={t('titulo')} className={className}>
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <BookOpen className="size-10 text-[var(--color-text-muted)]" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t('vacio_titulo')}
          </h3>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{t('vacio_descripcion')}</p>
        </div>
      </section>
    );
  }

  // ── List of assignments ───────────────────────────────────────────────────
  return (
    <section aria-labelledby="mis-cedularios-titulo" className={cn('flex flex-col gap-3', className)}>
      <div>
        <h2
          id="mis-cedularios-titulo"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {t('titulo')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">{t('descripcion')}</p>
      </div>

      <ul aria-label={t('lista_aria')} className="flex flex-col gap-3">
        {activas.map((asignacion) => (
          <li key={asignacion.asignacionId}>
            <button
              type="button"
              aria-label={t('abrir_aria', { cedulario: asignacion.cedularioNombre })}
              onClick={() => abrir(asignacion.cedularioId)}
              className={cn(
                'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-left',
                'transition-colors hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-secondary)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]',
              )}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {asignacion.cedularioNombre}
                  </p>
                  {asignacion.universidadNombre && (
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {asignacion.universidadNombre}
                    </p>
                  )}
                </div>
                <ProgresoBarra porcentaje={asignacion.porcentaje} tamano="sm" />
                <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>
                    {t('materias_cubiertas', {
                      cubiertas: asignacion.totalCubiertas,
                      total: asignacion.totalAsignadas,
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>{t('avance')}</span>
                    <PorcentajeTexto porcentaje={asignacion.porcentaje} className="text-sm" />
                  </span>
                </p>
              </div>
              <ChevronRight
                className="size-5 shrink-0 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
