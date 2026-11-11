'use client';

/**
 * "Cedularios" section of the student record (entry b of the per-student tracking).
 *
 * - One card per active assignment, with "Revisar" and (editors) "Desasignar".
 * - Collapsible history "Cedularios desasignados" with "Reasignar" (opens seg_modal=asignar
 *   with student and cedulario fixed).
 * - Empty state with "Asignar cedulario" (opens seg_modal=asignar with the student fixed).
 * - Inactive student (D-S20): assignments are read only and every assign action is hidden for
 *   everyone, admin included, with a notice.
 * - Observer professor: only "Revisar".
 * - Renders nothing when the summary returns no rows (not an alumno or not visible) and for the
 *   student's own view.
 *
 * The seg_* state is written with `useSegUrl`; the overlay itself is mounted by the host.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Collapsible } from '@/components/common/Collapsible';
import { useSegUrl } from '../url/useSegUrl';
import { AsignacionCard } from './AsignacionCard';
import { useResumenFicha } from './useResumenFicha';

export interface SeccionCedulariosFichaProps {
  alumnoId: string;
  /** Caller role of the record. The section is never shown to the student. */
  role?: 'profesor' | 'admin' | 'alumno';
  /** 'propio': the staff member's own cedularios (own copy, no alumno wording). */
  variante?: 'ficha' | 'propio';
}

export function SeccionCedulariosFicha({
  alumnoId,
  role = 'profesor',
  variante = 'ficha',
}: SeccionCedulariosFichaProps) {
  const t = useTranslations('cedularios.seguimiento.ficha');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const { abrir } = useSegUrl();
  const consulta = useResumenFicha(role === 'alumno' ? null : alumnoId);
  const { data, isPending, isError, isFetching, refetch } = consulta;

  const activas = useMemo(
    () => (data?.asignaciones ?? []).filter((asignacion) => asignacion.estado === 'activa'),
    [data],
  );
  const desasignadas = useMemo(
    () => (data?.asignaciones ?? []).filter((asignacion) => asignacion.estado === 'desasignada'),
    [data],
  );

  if (role === 'alumno') return null;

  const propio = variante === 'propio';
  const tituloTexto = propio ? t('propio_titulo') : t('titulo');
  const descripcionTexto = propio ? t('propio_descripcion') : t('descripcion');
  const vacioTitulo = propio ? t('propio_vacio_titulo') : t('vacio_titulo');
  const vacioDescripcion = propio ? t('propio_vacio_descripcion') : t('vacio_descripcion');

  const titulo = (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
      <BookOpen className="size-4 text-[var(--color-brand-gold)]" aria-hidden="true" />
      {tituloTexto}
    </h3>
  );
  const claseSeccion =
    'rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4';

  if (isPending) {
    return (
      <section aria-label={tituloTexto} className={claseSeccion}>
        {titulo}
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
        >
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{t('cargando')}</span>
        </div>
      </section>
    );
  }

  if (isError && !data) {
    return (
      <section aria-label={tituloTexto} className={claseSeccion}>
        {titulo}
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm text-[var(--color-error)]">{t('error_carga')}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            {tComun('reintentar')}
          </Button>
        </div>
      </section>
    );
  }

  // No rows: the student is not visible or does not have the alumno role
  if (!data) return null;

  const { alumno, puedeEditar, puedeAsignar } = data;
  const alumnoNombre = `${alumno.nombre} ${alumno.apellido}`.trim() || tComun('alumno_sin_nombre');

  const revisar = (cedularioId: string) =>
    abrir({ modal: 'revision', alumno: alumnoId, cedulario: cedularioId });
  const reasignar = (cedularioId: string) =>
    abrir({ modal: 'asignar', alumno: alumnoId, cedulario: cedularioId });
  const asignar = () => abrir({ modal: 'asignar', alumno: alumnoId });

  return (
    <section aria-label={tituloTexto} className={claseSeccion}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BookOpen className="size-4 text-[var(--color-brand-gold)]" aria-hidden="true" />
            {tituloTexto}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{descripcionTexto}</p>
        </div>
        {puedeAsignar && activas.length > 0 && (
          <Button type="button" size="sm" variant="secondary" onClick={asignar}>
            {t('asignar_cedulario')}
          </Button>
        )}
      </div>

      {!propio && !alumno.activo && (
        <p
          role="status"
          className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-sm)] text-sm text-[var(--color-text-muted)]"
        >
          {t('alumno_inactivo_aviso')}
        </p>
      )}

      {activas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activas.map((asignacion) => (
            <AsignacionCard
              key={asignacion.asignacionId}
              asignacion={asignacion}
              alumnoId={alumnoId}
              alumnoNombre={alumnoNombre}
              puedeEditar={puedeEditar}
              puedeAsignar={puedeAsignar}
              onRevisar={revisar}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{vacioTitulo}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{vacioDescripcion}</p>
          {puedeAsignar && (
            <Button type="button" size="sm" onClick={asignar}>
              {t('asignar_cedulario')}
            </Button>
          )}
        </div>
      )}

      {desasignadas.length > 0 && (
        <Collapsible
          className="mt-3"
          title={t('desasignados_titulo')}
          badge={desasignadas.length}
          defaultOpen={false}
          contentClassName="p-3"
        >
          <ul aria-label={t('desasignados_conteo', { count: desasignadas.length })} className="flex flex-col gap-2">
            {desasignadas.map((asignacion) => (
              <AsignacionCard
                key={asignacion.asignacionId}
                asignacion={asignacion}
                alumnoId={alumnoId}
                alumnoNombre={alumnoNombre}
                puedeEditar={puedeEditar}
                puedeAsignar={puedeAsignar}
                onRevisar={revisar}
                onReasignar={reasignar}
              />
            ))}
          </ul>
        </Collapsible>
      )}
    </section>
  );
}
