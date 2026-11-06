'use client';

import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { universidadSchema, type UniversidadData, type UniversidadInput } from '@/lib/cedularios/schemas';
import type { ActionError } from '@/lib/cedularios/action-result';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCrearUniversidad, useEditarUniversidad } from '../hooks/useUniversidades';
import { LogoUploader } from './LogoUploader';

const CLASE_INPUT =
  'h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)]';

type CampoUniversidad = keyof UniversidadInput;
const CAMPOS: readonly CampoUniversidad[] = ['nombre', 'codigo'];

function esCampo(valor: string): valor is CampoUniversidad {
  return (CAMPOS as readonly string[]).includes(valor);
}

interface UniversidadFormProps {
  /** The universidad to edit. Omit it (or pass null) to create one. */
  universidad?: Universidad | null;
  onClose: () => void;
}

/**
 * Create / edit form of a universidad (Requirements 1.2, 1.3, 1.6, 11.11, 11.14), shown in a modal.
 *
 * The component is open while it is mounted: the parent (`UniversidadList`) mounts it from the
 * `ced_modal` URL value, so the form state starts clean every time it opens. The logo is uploaded
 * on its own (it is saved as soon as the file is chosen) and only for an existing universidad.
 */
export function UniversidadForm({ universidad = null, onClose }: UniversidadFormProps) {
  const t = useTranslations('cedularios');
  const { translateFieldError, showError } = useCedulariosAction();
  const formId = useId();
  const esEdicion = universidad !== null;

  // Field errors are shown beneath the fields, so the generic error toast is skipped.
  const crear = useCrearUniversidad({ skipErrorToast: true });
  const editar = useEditarUniversidad({ skipErrorToast: true });
  const guardando = crear.isPending || editar.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UniversidadInput, unknown, UniversidadData>({
    resolver: zodResolver(universidadSchema),
    defaultValues: { nombre: universidad?.nombre ?? '', codigo: universidad?.codigo ?? '' },
  });

  const aplicarErrores = (error: ActionError) => {
    let hayErrorDeCampo = false;
    for (const [campo, codigo] of Object.entries(error.fields ?? {})) {
      if (!esCampo(campo)) continue;
      setError(campo, { type: 'server', message: codigo }, { shouldFocus: !hayErrorDeCampo });
      hayErrorDeCampo = true;
    }
    if (!hayErrorDeCampo) showError(error);
  };

  const alEnviar = async (valores: UniversidadData) => {
    const resultado = universidad
      ? await editar.mutateAsync({ id: universidad.id, input: valores })
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

  const errorNombre = errors.nombre?.message;
  const errorCodigo = errors.codigo?.message;

  return (
    <Modal
      open
      onClose={cerrar}
      title={esEdicion ? t('universidades.formulario.titulo_editar') : t('universidades.formulario.titulo_crear')}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={guardando}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form={formId} variant="primary" size="sm" loading={guardando}>
            {guardando ? t('comun.guardando') : t('universidades.formulario.guardar')}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-nombre`} className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('universidades.campos.nombre')} <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
          </label>
          <input
            id={`${formId}-nombre`}
            {...register('nombre')}
            className={CLASE_INPUT}
            placeholder={t('universidades.placeholders.nombre')}
            autoComplete="off"
            aria-required="true"
            aria-invalid={errorNombre ? 'true' : 'false'}
            aria-describedby={errorNombre ? `${formId}-nombre-error` : undefined}
            readOnly={guardando}
          />
          {errorNombre && (
            <p id={`${formId}-nombre-error`} role="alert" className="text-xs text-[var(--color-error)]">
              {translateFieldError(String(errorNombre))}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-codigo`} className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('universidades.campos.codigo')} <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
          </label>
          <input
            id={`${formId}-codigo`}
            {...register('codigo')}
            className={CLASE_INPUT}
            placeholder={t('universidades.placeholders.codigo')}
            autoComplete="off"
            aria-required="true"
            aria-invalid={errorCodigo ? 'true' : 'false'}
            aria-describedby={
              errorCodigo ? `${formId}-codigo-error` : `${formId}-codigo-ayuda`
            }
            readOnly={guardando}
          />
          {errorCodigo ? (
            <p id={`${formId}-codigo-error`} role="alert" className="text-xs text-[var(--color-error)]">
              {translateFieldError(String(errorCodigo))}
            </p>
          ) : (
            <p id={`${formId}-codigo-ayuda`} className="text-xs text-[var(--color-text-muted)]">
              {t('universidades.ayudas.codigo')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('universidades.campos.logo')}{' '}
            <span className="text-xs font-normal text-[var(--color-text-muted)]">({t('comun.opcional')})</span>
          </span>
          <LogoUploader universidad={universidad} />
        </div>
      </form>
    </Modal>
  );
}
