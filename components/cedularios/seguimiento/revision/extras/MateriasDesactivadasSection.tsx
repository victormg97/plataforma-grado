'use client';

/**
 * "Materias desactivadas" section of the Revisor (edit mode only; the parent decides when to
 * render it). Read-only history of the materias that were deactivated in the cedulario but
 * still have progress in the assignment. They do not count in any percentage. Data comes from
 * `useMateriasInactivas` (staff only RPC), so it is requested only when `enabled` is true.
 */

import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Collapsible } from '@/components/common/Collapsible';
import { cn } from '@/lib/utils';
import { useMateriasInactivas } from '../../hooks/useMateriasInactivas';

export interface MateriasDesactivadasSectionProps {
  asignacionId: string;
  /** False for students and readers: the RPC rejects them, so no request is made. */
  enabled?: boolean;
  className?: string;
}

/** 'yyyy-MM-dd' shown as 'dd/MM/yyyy'; unparseable values are shown as they are. */
function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : valor;
}

export function MateriasDesactivadasSection({
  asignacionId,
  enabled = true,
  className,
}: MateriasDesactivadasSectionProps) {
  const t = useTranslations('cedularios.seguimiento.revision.desactivadas');
  const tArchivadas = useTranslations('cedularios.seguimiento.revision.archivadas');
  const tFila = useTranslations('cedularios.seguimiento.revision.fila');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const tRevision = useTranslations('cedularios.seguimiento.revision');

  const { data, isPending, isError, refetch, isFetching } = useMateriasInactivas(asignacionId, {
    enabled,
  });

  const filas = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) =>
        a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
      ),
    [data],
  );

  return (
    <Collapsible
      title={t('titulo')}
      badge={data ? filas.length : undefined}
      className={className}
    >
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t('descripcion')}</p>

      {isPending ? (
        <p role="status" className="py-2 text-sm text-[var(--color-text-muted)]">
          {tComun('cargando')}
        </p>
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-2">
          <p className="text-sm text-[var(--color-error)]">{tRevision('error_carga')}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isFetching}
            onClick={() => void refetch()}
          >
            {tComun('reintentar')}
          </Button>
        </div>
      ) : filas.length === 0 ? (
        <p role="status" className="py-2 text-sm text-[var(--color-text-muted)]">
          {t('vacio')}
        </p>
      ) : (
        <>
          <p className="sr-only" role="status">
            {t('conteo', { count: filas.length })}
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {filas.map((fila) => {
              const cubierta = fila.estado === 'cubierta';
              return (
                <li key={fila.materiaId} className="space-y-1 py-3">
                  <p className="flex flex-wrap items-baseline gap-2 text-sm text-[var(--color-text-muted)]">
                    <span className="shrink-0 font-semibold">{fila.codigo}</span>
                    <span className="min-w-0 truncate">{fila.nombre}</span>
                    <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium">
                      {t('etiqueta')}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        cubierta
                          ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                          : 'bg-[var(--color-bg-secondary)]',
                      )}
                    >
                      {cubierta
                        ? tArchivadas('estado_cubierta')
                        : tArchivadas('estado_pendiente')}
                    </span>
                    {cubierta && fila.fechaCubierta && (
                      <span>
                        {tFila('cubierta_el', { fecha: formatearFecha(fila.fechaCubierta) })}
                      </span>
                    )}
                    <span>
                      {tArchivadas('con_datos', {
                        repasos: fila.repasos,
                        comentarios: fila.comentarios,
                      })}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Collapsible>
  );
}
