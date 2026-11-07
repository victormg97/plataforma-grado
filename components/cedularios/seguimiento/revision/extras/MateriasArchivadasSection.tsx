'use client';

/**
 * "Materias archivadas" section of the Revisor (edit mode only; the parent decides when to
 * render it). Lists the progress rows with `asignada = false` of an assignment: the materia
 * was removed from the subset but its data is kept. Each row shows coverage, covered date,
 * note and the counts of reviews and comments, plus a "Restore" action that sets
 * `asignada = true` through the subset mutation. Rows whose materia is not in the active
 * list are skipped: those are shown by the deactivated materias section.
 */

import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArchiveRestore } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Collapsible } from '@/components/common/Collapsible';
import { cn } from '@/lib/utils';
import type { ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import type { MateriaNodo } from '@/lib/cedularios/tree';
import { useEstablecerMaterias } from '../../hooks/useEstablecerMaterias';

export interface MateriasArchivadasSectionProps {
  asignacionId: string;
  /** Student of the assignment. Narrows the cache invalidation after a restore. */
  alumnoId: string;
  /** Cedulario of the assignment. Narrows the cache invalidation after a restore. */
  cedularioId: string;
  /** Active materias of the cedulario (used to resolve code and name). */
  materias: readonly MateriaNodo[];
  /** All progress rows of the assignment. Only rows with `asignada = false` are used. */
  progreso: readonly ProgresoFila[];
  className?: string;
}

interface FilaArchivada {
  progreso: ProgresoFila;
  materia: MateriaNodo;
}

/** 'yyyy-MM-dd' shown as 'dd/MM/yyyy'; unparseable values are shown as they are. */
function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : valor;
}

export function MateriasArchivadasSection({
  asignacionId,
  alumnoId,
  cedularioId,
  materias,
  progreso,
  className,
}: MateriasArchivadasSectionProps) {
  const t = useTranslations('cedularios.seguimiento.revision.archivadas');
  const tFila = useTranslations('cedularios.seguimiento.revision.fila');
  const tNota = useTranslations('cedularios.seguimiento.detalle.nota');
  const { mutate, isPending, variables } = useEstablecerMaterias();

  const filas = useMemo<FilaArchivada[]>(() => {
    const porId = new Map(materias.map((m) => [m.id, m]));
    const resultado: FilaArchivada[] = [];
    for (const fila of progreso) {
      if (fila.asignada) continue;
      const materia = porId.get(fila.materiaId);
      if (materia && materia.activo) resultado.push({ progreso: fila, materia });
    }
    return resultado.sort((a, b) =>
      a.materia.codigo.localeCompare(b.materia.codigo, undefined, { numeric: true }),
    );
  }, [materias, progreso]);

  const restaurar = (materiaId: string) => {
    mutate({ asignacionId, agregar: [materiaId], quitar: [], alumnoId, cedularioId });
  };

  return (
    <Collapsible title={t('titulo')} badge={filas.length} className={className}>
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t('descripcion')}</p>

      {filas.length === 0 ? (
        <p role="status" className="py-2 text-sm text-[var(--color-text-muted)]">
          {t('vacio')}
        </p>
      ) : (
        <>
          <p className="sr-only" role="status">
            {t('conteo', { count: filas.length })}
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {filas.map(({ progreso: fila, materia }) => {
              const cubierta = fila.estado === 'cubierta';
              const restaurando = isPending && variables?.agregar?.[0] === materia.id;
              const nota = fila.notas?.trim() ?? '';
              return (
                <li
                  key={fila.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">
                        {materia.codigo}
                      </span>
                      <span className="min-w-0 truncate text-[var(--color-text-primary)]">
                        {materia.nombre}
                      </span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-medium',
                          cubierta
                            ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]',
                        )}
                      >
                        {cubierta ? t('estado_cubierta') : t('estado_pendiente')}
                      </span>
                      {cubierta && fila.fechaCubierta && (
                        <span>{tFila('cubierta_el', { fecha: formatearFecha(fila.fechaCubierta) })}</span>
                      )}
                      <span>
                        {t('con_datos', { repasos: fila.repasos, comentarios: fila.comentarios })}
                      </span>
                    </p>
                    {nota !== '' && (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        <span className="font-medium">{tNota('titulo')}: </span>
                        {/* Plain text only; never raw HTML. */}
                        <span className="whitespace-pre-wrap break-words">{nota}</span>
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<ArchiveRestore className="size-4" />}
                    loading={restaurando}
                    disabled={isPending}
                    aria-label={t('restaurar_aria', { materia: materia.nombre })}
                    onClick={() => restaurar(materia.id)}
                  >
                    {t('restaurar')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Collapsible>
  );
}
