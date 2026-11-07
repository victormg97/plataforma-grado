'use client';

/**
 * "Repasos" section of the materia detail panel.
 *
 * - Lists the reviews newest first (date, then creation time) with the total count.
 * - Edit mode: add form (date defaults to today in Chile, capped at today), inline edit and
 *   delete with confirmation. Validation uses `repasoSchema`; field errors show under the field
 *   and the typed values are kept on any failure.
 * - Read mode: plain text only, no forms or buttons.
 */

import { useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isValid, parseISO } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { cn } from '@/lib/utils';
import { MAX_REPASO_NOTA } from '@/lib/cedularios/seguimiento/constants';
import { hoyEnChile } from '@/lib/cedularios/seguimiento/fechas';
import type { RepasoDetalle } from '@/lib/queries/cedularios/seguimiento/progreso';
import {
  repasoSchema,
  type RepasoData,
  type RepasoInput,
} from '@/lib/validations/cedularioSeguimiento.schema';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import { esIdTemporal, useDetalleMutations } from '../../hooks/useDetalleMutations';

const CLASE_CAMPO =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)] read-only:opacity-70';

/** 'yyyy-MM-dd' shown as 'dd/MM/yyyy'; unparseable values are shown as they are. */
function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : valor;
}

/** Newest first: by date, then by creation time. Never mutates the input. */
function ordenarRepasos(lista: readonly RepasoDetalle[]): RepasoDetalle[] {
  return [...lista].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

interface RepasosSectionProps {
  /** Id of the assignment that owns the progress row. */
  asignacionId: string;
  /** Id of the progress row of the materia. */
  progresoId: string;
  /** Reviews of the materia, as loaded in the detail. */
  repasos: readonly RepasoDetalle[];
  /** True in edit mode; false renders read-only text. */
  editable: boolean;
  className?: string;
}

export function RepasosSection({
  asignacionId,
  progresoId,
  repasos,
  editable,
  className,
}: RepasosSectionProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.repasos');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const idBase = useId();
  const { crearRepaso, editarRepaso, eliminarRepaso } = useDetalleMutations(
    asignacionId,
    progresoId,
  );

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<RepasoDetalle | null>(null);

  const ordenados = useMemo(() => ordenarRepasos(repasos), [repasos]);

  const guardarNuevo = (datos: RepasoData, limpiar: () => void) => {
    crearRepaso.mutate(
      { fecha: datos.fecha, nota: datos.nota },
      {
        onSuccess: (resultado) => {
          // On failure the hook rolls back and shows the toast; the form keeps its values.
          if (resultado.ok) limpiar();
        },
      },
    );
  };

  const guardarEdicion = (id: string, datos: RepasoData) => {
    editarRepaso.mutate(
      { id, fecha: datos.fecha, nota: datos.nota },
      {
        onSuccess: (resultado) => {
          if (resultado.ok) setEditandoId((actual) => (actual === id ? null : actual));
        },
      },
    );
  };

  const confirmarEliminar = () => {
    if (!porEliminar) return;
    eliminarRepaso.mutate(
      { id: porEliminar.id },
      {
        onSuccess: (resultado) => {
          if (resultado.ok) setEditandoId((actual) => (actual === porEliminar.id ? null : actual));
        },
        onSettled: () => setPorEliminar(null),
      },
    );
  };

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-labelledby={`${idBase}-titulo`}>
      <div className="flex items-baseline justify-between gap-3">
        <h4
          id={`${idBase}-titulo`}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {t('titulo')}
        </h4>
        <span className="text-xs text-[var(--color-text-muted)]">
          {t('conteo', { count: ordenados.length })}
        </span>
      </div>

      {editable && (
        <RepasoFormulario
          valorInicial={{ fecha: hoyEnChile(), nota: '' }}
          etiquetaEnviar={t('agregar')}
          etiquetaEnviando={t('agregando')}
          pendiente={crearRepaso.isPending}
          limpiarAlExito
          onEnviar={guardarNuevo}
        />
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('vacio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenados.map((repaso) => {
            const temporal = esIdTemporal(repaso.id);
            const enEdicion = editable && editandoId === repaso.id;
            const editando = editarRepaso.isPending && editarRepaso.variables?.id === repaso.id;
            const eliminando =
              eliminarRepaso.isPending && eliminarRepaso.variables?.id === repaso.id;

            return (
              <li
                key={repaso.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
              >
                {enEdicion ? (
                  <RepasoFormulario
                    valorInicial={{ fecha: repaso.fecha, nota: repaso.nota ?? '' }}
                    etiquetaEnviar={t('guardar_edicion')}
                    etiquetaEnviando={tComun('guardando')}
                    pendiente={editando}
                    onEnviar={(datos) => guardarEdicion(repaso.id, datos)}
                    onCancelar={() => setEditandoId(null)}
                    etiquetaCancelar={t('cancelar_edicion')}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {formatearFecha(repaso.fecha)}
                        </span>
                        {repaso.autorNombre && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {repaso.autorNombre}
                          </span>
                        )}
                      </p>
                      {repaso.nota ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">
                          {repaso.nota}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {t('sin_nota')}
                        </p>
                      )}
                    </div>
                    {editable && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-8 px-0"
                          aria-label={t('editar')}
                          title={t('editar')}
                          disabled={temporal || eliminando}
                          onClick={() => setEditandoId(repaso.id)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-8 px-0"
                          aria-label={t('eliminar')}
                          title={t('eliminar')}
                          disabled={temporal || eliminando}
                          onClick={() => setPorEliminar(repaso)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <ConfirmModal
          open={porEliminar !== null}
          onClose={() => setPorEliminar(null)}
          onConfirm={confirmarEliminar}
          title={t('confirmar_eliminar_titulo')}
          description={
            porEliminar
              ? t('confirmar_eliminar_descripcion', { fecha: formatearFecha(porEliminar.fecha) })
              : ''
          }
          confirmText={t('confirmar_eliminar')}
          cancelText={tComun('cancelar')}
          loading={eliminarRepaso.isPending}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form (shared by "add" and "edit")
// ---------------------------------------------------------------------------

interface RepasoFormularioProps {
  valorInicial: { fecha: string; nota: string };
  etiquetaEnviar: string;
  etiquetaEnviando: string;
  pendiente: boolean;
  /** Resets the form to today and an empty note once the save succeeded (add form). */
  limpiarAlExito?: boolean;
  /** Receives the validated values and a callback that clears the form (add form only). */
  onEnviar: (datos: RepasoData, limpiar: () => void) => void;
  onCancelar?: () => void;
  etiquetaCancelar?: string;
}

function RepasoFormulario({
  valorInicial,
  etiquetaEnviar,
  etiquetaEnviando,
  pendiente,
  limpiarAlExito = false,
  onEnviar,
  onCancelar,
  etiquetaCancelar,
}: RepasoFormularioProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.repasos');
  const { translateFieldError } = useCedulariosAction();
  const idBase = useId();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<RepasoInput, unknown, RepasoData>({
    resolver: zodResolver(repasoSchema),
    mode: 'onChange',
    defaultValues: valorInicial,
  });

  const nota = useWatch({ control, name: 'nota' }) ?? '';
  const errorFecha = errors.fecha?.message;
  const errorNota = errors.nota?.message;
  // The date input is capped at today in the platform time zone.
  const hoy = hoyEnChile();

  const alEnviar = (datos: RepasoData) => {
    const limpiar = () => {
      if (limpiarAlExito) reset({ fecha: hoyEnChile(), nota: '' });
    };
    onEnviar(datos, limpiar);
  };

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idBase}-fecha`}
          className="text-xs font-medium text-[var(--color-text-primary)]"
        >
          {t('fecha')}
        </label>
        <input
          id={`${idBase}-fecha`}
          type="date"
          max={hoy}
          {...register('fecha')}
          readOnly={pendiente}
          aria-invalid={errorFecha ? 'true' : 'false'}
          aria-describedby={errorFecha ? `${idBase}-fecha-error` : undefined}
          className={cn(CLASE_CAMPO, 'h-9 sm:w-48')}
        />
        {errorFecha && (
          <p id={`${idBase}-fecha-error`} role="alert" className="text-xs text-[var(--color-error)]">
            {translateFieldError(String(errorFecha))}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idBase}-nota`}
          className="text-xs font-medium text-[var(--color-text-primary)]"
        >
          {t('nota')}
        </label>
        <textarea
          id={`${idBase}-nota`}
          rows={2}
          {...register('nota')}
          placeholder={t('nota_placeholder')}
          readOnly={pendiente}
          aria-invalid={errorNota ? 'true' : 'false'}
          aria-describedby={errorNota ? `${idBase}-nota-error` : `${idBase}-nota-contador`}
          className={cn(CLASE_CAMPO, 'resize-y py-2')}
        />
        {errorNota ? (
          <p id={`${idBase}-nota-error`} role="alert" className="text-xs text-[var(--color-error)]">
            {translateFieldError(String(errorNota))}
          </p>
        ) : (
          <p
            id={`${idBase}-nota-contador`}
            className={cn(
              'text-xs',
              nota.length > MAX_REPASO_NOTA
                ? 'text-[var(--color-error)]'
                : 'text-[var(--color-text-muted)]',
            )}
          >
            {t('contador', { actual: nota.length, max: MAX_REPASO_NOTA })}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancelar && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={pendiente}>
            {etiquetaCancelar}
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm" loading={pendiente}>
          {pendiente ? etiquetaEnviando : etiquetaEnviar}
        </Button>
      </div>
    </form>
  );
}
