'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { ActionError } from '@/lib/cedularios/action-result';
import {
  LIMITES,
  cedularioSchema,
  type CedularioData,
  type CedularioInput,
} from '@/lib/cedularios/schemas';
import type { CedularioDetalle } from '@/lib/queries/cedularios/cedularios';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulario, useCrearCedulario, useEditarCedulario } from '../hooks/useCedularios';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { useUniversidades } from '../hooks/useUniversidades';
import { puedeGestionarCedularioDe } from './permisosCedulario';

const CLASE_INPUT =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)]';

type CampoCedulario = keyof CedularioInput;
const CAMPOS: readonly CampoCedulario[] = ['universidad_id', 'nombre', 'version', 'descripcion'];

function esCampo(valor: string): valor is CampoCedulario {
  return (CAMPOS as readonly string[]).includes(valor);
}

interface CampoProps {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  /** Translated error message, if any. */
  error?: string;
  /** Current length and limit; shows the character counter when given. */
  contador?: { actual: number; max: number };
  children: (props: { 'aria-invalid': 'true' | 'false'; 'aria-describedby': string | undefined }) => ReactNode;
}

function Campo({ id, etiqueta, requerido = false, error, contador, children }: CampoProps) {
  const t = useTranslations('cedularios');
  const idError = `${id}-error`;
  const idContador = `${id}-contador`;
  const describedBy = [error ? idError : null, contador ? idContador : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
        {etiqueta}{' '}
        {requerido ? (
          <span className="text-[var(--color-error)]" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-[var(--color-text-muted)]">({t('comun.opcional')})</span>
        )}
      </label>
      {children({
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': describedBy === '' ? undefined : describedBy,
      })}
      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p id={idError} role="alert" className="text-xs text-[var(--color-error)]">
            {error}
          </p>
        ) : (
          <span />
        )}
        {contador && (
          <p
            id={idContador}
            className={
              contador.actual > contador.max
                ? 'shrink-0 text-xs text-[var(--color-error)]'
                : 'shrink-0 text-xs text-[var(--color-text-muted)]'
            }
          >
            {t('comun.caracteres', { actual: contador.actual, max: contador.max })}
          </p>
        )}
      </div>
    </div>
  );
}

interface CedularioFormProps {
  /** Id of the cedulario to edit. Omit it (or pass null) to create one. */
  cedularioId?: string | null;
  /** Universidad preselected when creating (normally `ced_uni`). */
  universidadIdInicial?: string | null;
  onClose: () => void;
}

/**
 * Create / edit form of a cedulario in a modal (Requirements 2.2, 2.3, 2.6, 2.14, 2.15, 11.2).
 *
 * The form is open while it is mounted: the host mounts it from the `ced_modal` URL value
 * (`nuevo-cedulario` or `editar-cedulario:<id>`, see `modalCedulario.ts`). When editing, the
 * cedulario is loaded first because the list rows do not carry the descripción.
 */
export function CedularioForm({ cedularioId = null, universidadIdInicial = null, onClose }: CedularioFormProps) {
  const t = useTranslations('cedularios');
  const detalle = useCedulario(cedularioId);
  const esEdicion = cedularioId !== null;
  const noExiste = esEdicion && detalle.isSuccess && detalle.data === null;

  // The cedulario of a shared link may be gone or hidden: close the form.
  useEffect(() => {
    if (noExiste) onClose();
  }, [noExiste, onClose]);

  if (!esEdicion || (detalle.isSuccess && detalle.data !== null)) {
    return (
      <CedularioFormContenido
        key={cedularioId ?? 'nuevo'}
        cedulario={detalle.data ?? null}
        universidadIdInicial={universidadIdInicial}
        onClose={onClose}
      />
    );
  }

  const titulo = t('cedularios.formulario.titulo_editar');
  return (
    <Modal open onClose={onClose} title={titulo}>
      {detalle.isError ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
          <p className="text-sm text-[var(--color-text-secondary)]">{t(`errores.${codigoDeError(detalle.error)}`)}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void detalle.refetch()}>
            {t('comun.reintentar')}
          </Button>
        </div>
      ) : (
        <div role="status" aria-busy="true" aria-label={t('comun.cargando')} className="flex animate-pulse flex-col gap-4">
          <div className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
          <div className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
          <div className="h-24 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
        </div>
      )}
    </Modal>
  );
}

interface CedularioFormContenidoProps {
  cedulario: CedularioDetalle | null;
  universidadIdInicial: string | null;
  onClose: () => void;
}

function CedularioFormContenido({ cedulario, universidadIdInicial, onClose }: CedularioFormContenidoProps) {
  const t = useTranslations('cedularios');
  const { translateFieldError, showError } = useCedulariosAction();
  const usuario = useCedulariosUsuario();
  const universidadesQuery = useUniversidades();
  const formId = useId();
  const esEdicion = cedulario !== null;

  // Editing the universidad is offered only to an admin or the creator (the DB guard rejects the rest).
  const puedeCambiarUniversidad = !esEdicion || puedeGestionarCedularioDe(usuario, cedulario.created_by);

  // Field errors are shown beneath the fields, so the generic error toast is skipped.
  const crear = useCrearCedulario({ skipErrorToast: true });
  const editar = useEditarCedulario({ skipErrorToast: true });
  const guardando = crear.isPending || editar.isPending;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CedularioInput, unknown, CedularioData>({
    resolver: zodResolver(cedularioSchema),
    defaultValues: {
      universidad_id: cedulario?.universidad_id ?? universidadIdInicial ?? '',
      nombre: cedulario?.nombre ?? '',
      version: cedulario?.version ?? '',
      descripcion: cedulario?.descripcion ?? '',
    },
  });

  const universidadActual = useWatch({ control, name: 'universidad_id' });
  const largoNombre = (useWatch({ control, name: 'nombre' }) ?? '').length;
  const largoVersion = (useWatch({ control, name: 'version' }) ?? '').length;
  const largoDescripcion = (useWatch({ control, name: 'descripcion' }) ?? '').length;

  const opcionesUniversidad = (universidadesQuery.data ?? [])
    .filter((u) => u.activo || u.id === universidadActual)
    .map((u) => ({ value: u.id, label: u.nombre }));

  const aplicarErrores = (error: ActionError) => {
    let hayErrorDeCampo = false;
    for (const [campo, codigo] of Object.entries(error.fields ?? {})) {
      if (!esCampo(campo)) continue;
      setError(campo, { type: 'server', message: codigo }, { shouldFocus: !hayErrorDeCampo });
      hayErrorDeCampo = true;
    }
    // No field to blame (permissions, connection, solo_creador_o_admin...): show the message.
    if (!hayErrorDeCampo) showError(error);
  };

  const alEnviar = async (valores: CedularioData) => {
    const resultado = cedulario
      ? await editar.mutateAsync({
          id: cedulario.id,
          input: {
            nombre: valores.nombre,
            version: valores.version ?? '',
            descripcion: valores.descripcion ?? '',
            ...(puedeCambiarUniversidad && valores.universidad_id !== cedulario.universidad_id
              ? { universidad_id: valores.universidad_id }
              : {}),
          },
        })
      : await crear.mutateAsync(valores);
    if (resultado.ok) {
      onClose();
      return;
    }
    // The values stay in the form so the user can correct them.
    aplicarErrores(resultado.error);
  };

  const cerrar = () => {
    if (!guardando) onClose();
  };

  const mensajeError = (campo: CampoCedulario): string | undefined => {
    const mensaje = errors[campo]?.message;
    return mensaje ? translateFieldError(String(mensaje)) : undefined;
  };

  return (
    <Modal
      open
      onClose={cerrar}
      title={esEdicion ? t('cedularios.formulario.titulo_editar') : t('cedularios.formulario.titulo_crear')}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={guardando}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form={formId} variant="primary" size="sm" loading={guardando}>
            {guardando ? t('comun.guardando') : t('cedularios.formulario.guardar')}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
        {puedeCambiarUniversidad && (
          <Campo
            id={`${formId}-universidad`}
            etiqueta={t('cedularios.campos.universidad')}
            requerido
            error={mensajeError('universidad_id')}
          >
            {(ariaProps) => (
              <Controller
                control={control}
                name="universidad_id"
                render={({ field }) => (
                  <AppSelect
                    id={`${formId}-universidad`}
                    value={field.value}
                    onChange={field.onChange}
                    options={opcionesUniversidad}
                    placeholder={t('cedularios.placeholders.universidad')}
                    className={
                      ariaProps['aria-invalid'] === 'true' ? 'w-full !border-[var(--color-error)]' : 'w-full'
                    }
                    disabled={guardando}
                  />
                )}
              />
            )}
          </Campo>
        )}

        <Campo
          id={`${formId}-nombre`}
          etiqueta={t('cedularios.campos.nombre')}
          requerido
          error={mensajeError('nombre')}
          contador={{ actual: largoNombre, max: LIMITES.cedularioNombre }}
        >
          {(ariaProps) => (
            <input
              id={`${formId}-nombre`}
              {...register('nombre')}
              {...ariaProps}
              className={`${CLASE_INPUT} h-10`}
              placeholder={t('cedularios.placeholders.nombre')}
              autoComplete="off"
              aria-required="true"
              readOnly={guardando}
            />
          )}
        </Campo>

        <Campo
          id={`${formId}-version`}
          etiqueta={t('cedularios.campos.version')}
          error={mensajeError('version')}
          contador={{ actual: largoVersion, max: LIMITES.cedularioVersion }}
        >
          {(ariaProps) => (
            <input
              id={`${formId}-version`}
              {...register('version')}
              {...ariaProps}
              className={`${CLASE_INPUT} h-10`}
              placeholder={t('cedularios.placeholders.version')}
              autoComplete="off"
              readOnly={guardando}
            />
          )}
        </Campo>

        <Campo
          id={`${formId}-descripcion`}
          etiqueta={t('cedularios.campos.descripcion')}
          error={mensajeError('descripcion')}
          contador={{ actual: largoDescripcion, max: LIMITES.cedularioDescripcion }}
        >
          {(ariaProps) => (
            <textarea
              id={`${formId}-descripcion`}
              {...register('descripcion')}
              {...ariaProps}
              rows={4}
              className={`${CLASE_INPUT} min-h-24 resize-y py-2`}
              placeholder={t('cedularios.placeholders.descripcion')}
              readOnly={guardando}
            />
          )}
        </Campo>
      </form>
    </Modal>
  );
}
