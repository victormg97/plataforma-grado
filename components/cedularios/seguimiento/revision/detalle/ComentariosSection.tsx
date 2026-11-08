'use client';

/**
 * "Comentarios" section of the materia detail panel.
 *
 * - Lists the comments oldest first with author and date, and the total count.
 * - Edit mode: add form; inline edit and delete (with confirmation) only for the author or an
 *   admin (`puedeEditarComentario`). Validation uses `comentarioSchema`; field errors show under
 *   the field and the typed text is kept on any failure.
 * - Read mode: plain text only (always a React text child, never HTML), no forms or buttons.
 */

import { useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/hooks/useUser';
import { MAX_COMENTARIO } from '@/lib/cedularios/seguimiento/constants';
import { puedeEditarComentario } from '@/lib/cedularios/seguimiento/permisos';
import type { ComentarioDetalle } from '@/lib/queries/cedularios/seguimiento/progreso';
import { comentarioSchema } from '@/lib/validations/cedularioSeguimiento.schema';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import { esIdTemporal, useDetalleMutations } from '../../hooks/useDetalleMutations';
import { useSegRol } from '../../hooks/useSegRol';
import { useRegistrarCambios } from './cambiosSinGuardar';

/** The form wraps the shared comment schema so its error key lands on the `texto` field. */
const comentarioFormSchema = z.object({ texto: comentarioSchema });
type ComentarioFormInput = z.input<typeof comentarioFormSchema>;
type ComentarioFormData = z.output<typeof comentarioFormSchema>;

const CLASE_CAMPO =
  'w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)] read-only:opacity-70';

/** ISO timestamp shown as 'dd/MM/yyyy HH:mm' (Spanish locale); unparseable values stay as they are. */
function formatearFechaHora(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy HH:mm', { locale: es }) : valor;
}

/** Oldest first: by creation time, then by id for a stable order. Never mutates the input. */
function ordenarComentarios(lista: readonly ComentarioDetalle[]): ComentarioDetalle[] {
  return [...lista].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

interface ComentariosSectionProps {
  /** Id of the assignment that owns the progress row. */
  asignacionId: string;
  /** Id of the progress row of the materia. */
  progresoId: string;
  /** Comments of the materia, as loaded in the detail. */
  comentarios: readonly ComentarioDetalle[];
  /** True in edit mode; false renders read-only text. */
  editable: boolean;
  className?: string;
}

export function ComentariosSection({
  asignacionId,
  progresoId,
  comentarios,
  editable,
  className,
}: ComentariosSectionProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.comentarios');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const idBase = useId();
  const { rol, userId } = useSegRol();
  const { user } = useUser();
  const { crearComentario, editarComentario, eliminarComentario } = useDetalleMutations(
    asignacionId,
    progresoId,
  );

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<ComentarioDetalle | null>(null);

  const ordenados = useMemo(() => ordenarComentarios(comentarios), [comentarios]);

  // Name shown on the optimistic row until the refetch brings the real one.
  const autorNombre = user ? `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim() || null : null;

  const guardarNuevo = (datos: ComentarioFormData, limpiar: () => void) => {
    crearComentario.mutate(
      { texto: datos.texto, autorNombre },
      {
        onSuccess: (resultado) => {
          // On failure the hook rolls back and shows the toast; the form keeps its text.
          if (resultado.ok) limpiar();
        },
      },
    );
  };

  const guardarEdicion = (id: string, datos: ComentarioFormData) => {
    editarComentario.mutate(
      { id, texto: datos.texto },
      {
        onSuccess: (resultado) => {
          if (resultado.ok) setEditandoId((actual) => (actual === id ? null : actual));
        },
      },
    );
  };

  const confirmarEliminar = () => {
    if (!porEliminar) return;
    const id = porEliminar.id;
    eliminarComentario.mutate(
      { id },
      {
        onSuccess: (resultado) => {
          if (resultado.ok) setEditandoId((actual) => (actual === id ? null : actual));
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

      {ordenados.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('vacio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenados.map((comentario) => {
            const temporal = esIdTemporal(comentario.id);
            const puedeGestionar =
              editable &&
              rol !== null &&
              userId !== null &&
              puedeEditarComentario({ rol, userId, autorId: comentario.autorId });
            const enEdicion = puedeGestionar && editandoId === comentario.id;
            const editando =
              editarComentario.isPending && editarComentario.variables?.id === comentario.id;
            const eliminando =
              eliminarComentario.isPending && eliminarComentario.variables?.id === comentario.id;

            return (
              <li
                key={comentario.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
              >
                {enEdicion ? (
                  <ComentarioFormulario
                    valorInicial={comentario.texto}
                    etiquetaEnviar={t('guardar_edicion')}
                    etiquetaEnviando={tComun('guardando')}
                    pendiente={editando}
                    onEnviar={(datos) => guardarEdicion(comentario.id, datos)}
                    onCancelar={() => setEditandoId(null)}
                    etiquetaCancelar={t('cancelar_edicion')}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--color-text-muted)]">
                        <span>
                          {t('autor_fecha', {
                            autor: comentario.autorNombre ?? tComun('sin_valor'),
                            fecha: formatearFechaHora(comentario.createdAt),
                          })}
                        </span>
                        {comentario.editedAt && <span>({t('editado')})</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">
                        {comentario.texto}
                      </p>
                    </div>
                    {puedeGestionar && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-8 px-0"
                          aria-label={t('editar')}
                          title={t('editar')}
                          disabled={temporal || eliminando}
                          onClick={() => setEditandoId(comentario.id)}
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
                          onClick={() => setPorEliminar(comentario)}
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
        <ComentarioFormulario
          valorInicial=""
          etiquetaEnviar={t('agregar')}
          etiquetaEnviando={t('agregando')}
          pendiente={crearComentario.isPending}
          limpiarAlExito
          onEnviar={guardarNuevo}
          ariaTexto={t('aria')}
        />
      )}

      {editable && (
        <ConfirmModal
          open={porEliminar !== null}
          onClose={() => setPorEliminar(null)}
          onConfirm={confirmarEliminar}
          title={t('confirmar_eliminar_titulo')}
          description={t('confirmar_eliminar_descripcion')}
          confirmText={t('confirmar_eliminar')}
          cancelText={tComun('cancelar')}
          loading={eliminarComentario.isPending}
          // Above the Revisor overlay (z-[70]).
          contentClassName="z-[80]"
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form (shared by "add" and "edit")
// ---------------------------------------------------------------------------

interface ComentarioFormularioProps {
  valorInicial: string;
  etiquetaEnviar: string;
  etiquetaEnviando: string;
  pendiente: boolean;
  /** Clears the textarea once the save succeeded (add form). */
  limpiarAlExito?: boolean;
  /** Receives the validated values and a callback that clears the form (add form only). */
  onEnviar: (datos: ComentarioFormData, limpiar: () => void) => void;
  onCancelar?: () => void;
  etiquetaCancelar?: string;
  /** Accessible name of the textarea. */
  ariaTexto?: string;
}

function ComentarioFormulario({
  valorInicial,
  etiquetaEnviar,
  etiquetaEnviando,
  pendiente,
  limpiarAlExito = false,
  onEnviar,
  onCancelar,
  etiquetaCancelar,
  ariaTexto,
}: ComentarioFormularioProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.comentarios');
  const { translateFieldError } = useCedulariosAction();
  const idBase = useId();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ComentarioFormInput, unknown, ComentarioFormData>({
    resolver: zodResolver(comentarioFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { texto: valorInicial },
  });

  const texto = useWatch({ control, name: 'texto' }) ?? '';
  // Unsaved comment (new or being edited): the Revisor asks before closing the panel.
  useRegistrarCambios(isDirty);
  const errorTexto = errors.texto?.message;

  const alEnviar = (datos: ComentarioFormData) => {
    const limpiar = () => {
      if (limpiarAlExito) reset({ texto: '' });
    };
    onEnviar(datos, limpiar);
  };

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-2">
      <textarea
        id={`${idBase}-texto`}
        rows={3}
        {...register('texto')}
        placeholder={t('placeholder')}
        aria-label={ariaTexto ?? t('editar')}
        aria-invalid={errorTexto ? 'true' : 'false'}
        aria-describedby={errorTexto ? `${idBase}-error` : `${idBase}-contador`}
        readOnly={pendiente}
        className={CLASE_CAMPO}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {errorTexto ? (
            <p id={`${idBase}-error`} role="alert" className="text-xs text-[var(--color-error)]">
              {translateFieldError(String(errorTexto))}
            </p>
          ) : (
            <p
              id={`${idBase}-contador`}
              className={cn(
                'text-xs',
                texto.length > MAX_COMENTARIO
                  ? 'text-[var(--color-error)]'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              {t('contador', { actual: texto.length, max: MAX_COMENTARIO })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCancelar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelar}
              disabled={pendiente}
            >
              {etiquetaCancelar}
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" loading={pendiente}>
            {pendiente ? etiquetaEnviando : etiquetaEnviar}
          </Button>
        </div>
      </div>
    </form>
  );
}
