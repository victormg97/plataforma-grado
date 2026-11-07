'use client';

/**
 * Dialog to link classes of the student to a materia.
 *
 * - Multi-select list of the student's classes (newest first), 50 per page with "load more".
 * - Search by title or date; `useClasesVinculables` debounces and caps the text.
 * - Classes already linked to this materia are shown checked and cannot be changed.
 * - Confirm sends the new picks only. The dialog closes on success; on failure it stays open
 *   with the picks kept (the hook rolls back the optimistic rows and shows the error toast).
 *
 * The caller mounts it only while it is open, so every opening starts with a clean state.
 */

import { useId, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/lib/utils';
import { SEG_BUSQUEDA_MAX } from '@/lib/cedularios/seguimiento/constants';
import type { ClaseVinculable } from '@/lib/queries/cedularios/seguimiento/asignables';
import { useClasesVinculables } from '../../hooks/useClasesVinculables';
import { useDetalleMutations } from '../../hooks/useDetalleMutations';

/** 'yyyy-MM-dd' shown with the `es` locale; unparseable values are shown as they are. */
function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'd MMM yyyy', { locale: es }) : valor;
}

interface VincularClasesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Id of the assignment; its student owns the classes offered. */
  asignacionId: string;
  /** Id of the progress row of the materia. */
  progresoId: string;
  /** Class ids (`horarios.id`) already linked to this materia. */
  horarioIdsVinculados: readonly string[];
}

export function VincularClasesDialog({
  open,
  onClose,
  asignacionId,
  progresoId,
  horarioIdsVinculados,
}: VincularClasesDialogProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.clases');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const idBase = useId();
  const { vincularClases } = useDetalleMutations(asignacionId, progresoId);

  const [busqueda, setBusqueda] = useState('');
  // Picked classes by id; the objects are kept so the list can show them at once on confirm.
  const [elegidas, setElegidas] = useState<ReadonlyMap<string, ClaseVinculable>>(new Map());

  const consulta = useClasesVinculables(asignacionId, busqueda, { enabled: open });
  const clases = consulta.data?.items ?? [];
  const yaVinculadas = useMemo(() => new Set(horarioIdsVinculados), [horarioIdsVinculados]);

  const enviando = vincularClases.isPending;
  const cargandoInicial = consulta.isPending;
  const hayError = consulta.isError && !consulta.data;

  const alternar = (clase: ClaseVinculable) => {
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      if (siguientes.has(clase.id)) siguientes.delete(clase.id);
      else siguientes.set(clase.id, clase);
      return siguientes;
    });
  };

  const confirmar = () => {
    if (elegidas.size === 0) return;
    vincularClases.mutate(
      { horarioIds: [...elegidas.keys()], clases: [...elegidas.values()] },
      {
        onSuccess: (resultado) => {
          if (resultado.ok) onClose();
        },
      },
    );
  };

  const footer = (
    <div className="flex w-full flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span aria-live="polite" className="text-xs text-[var(--color-text-muted)]">
        {t('seleccionadas', { count: elegidas.size })}
      </span>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={enviando}>
          {tComun('cancelar')}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={enviando}
          disabled={elegidas.size === 0}
          onClick={confirmar}
        >
          {enviando ? t('confirmando') : t('confirmar')}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('dialogo_titulo')}
      description={t('dialogo_descripcion')}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <input
          id={`${idBase}-buscar`}
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value.slice(0, SEG_BUSQUEDA_MAX))}
          placeholder={t('buscar_placeholder')}
          aria-label={t('buscar_aria')}
          maxLength={SEG_BUSQUEDA_MAX}
          className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
        />

        {cargandoInicial ? (
          <p role="status" className="text-sm text-[var(--color-text-muted)]">
            {tComun('cargando')}
          </p>
        ) : hayError ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-[var(--color-error)]">{tComun('error_carga')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void consulta.refetch()}>
              {tComun('reintentar')}
            </Button>
          </div>
        ) : clases.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('sin_resultados')}</p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label={t('dialogo_titulo')}>
            {clases.map((clase) => {
              const vinculada = yaVinculadas.has(clase.id);
              const marcada = vinculada || elegidas.has(clase.id);
              const titulo = clase.titulo.trim() ? clase.titulo : t('sin_titulo');
              const inputId = `${idBase}-clase-${clase.id}`;

              return (
                <li key={clase.id}>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-sm',
                      'hover:border-[var(--color-brand-gold)]',
                      (vinculada || enviando) && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={marcada}
                      disabled={vinculada || enviando}
                      onChange={() => alternar(clase)}
                      className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
                    />
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                      <span className="truncate font-medium text-[var(--color-text-primary)]">
                        {titulo}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {t('fecha_clase', { fecha: formatearFecha(clase.fecha) })}
                        {clase.horaInicio ? ` ${clase.horaInicio.slice(0, 5)}` : ''}
                      </span>
                    </span>
                    {!clase.activo && (
                      <span className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-error)] px-1.5 py-0.5 text-xs text-[var(--color-error)]">
                        {t('cancelada')}
                      </span>
                    )}
                    {vinculada && (
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        {t('ya_vinculada')}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {consulta.hasNextPage && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={consulta.isFetchingNextPage}
              onClick={() => void consulta.fetchNextPage()}
            >
              {t('cargar_mas')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
