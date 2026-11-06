'use client';

import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { enlaceSchema, LIMITES, type EnlaceInput } from '@/lib/cedularios/schemas';
import type { EnlaceScope } from '@/lib/cedularios/keys';
import type { Enlace } from '@/lib/queries/cedularios/enlaces';
import { useCrearEnlace, useEditarEnlace } from '../hooks/useEnlaces';
import { useCedulariosAction } from '../hooks/useCedulariosAction';

type CampoEnlace = 'url' | 'titulo' | 'descripcion';
const CAMPOS: readonly CampoEnlace[] = ['url', 'titulo', 'descripcion'];

export interface EnlaceFormProps {
  open: boolean;
  onClose: () => void;
  scope: EnlaceScope;
  /** Cedulario id or materia id, depending on `scope`. */
  parentId: string;
  /** Enlace being edited. Omit or pass `null` to create a new enlace. */
  enlace?: Enlace | null;
}

/** Dialog with the form to add or edit an enlace (url, título, descripción). */
export function EnlaceForm({ open, onClose, scope, parentId, enlace = null }: EnlaceFormProps) {
  const t = useTranslations('cedularios');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={enlace ? t('enlaces.formulario.titulo_editar') : t('enlaces.formulario.titulo_crear')}
    >
      <EnlaceFormCuerpo scope={scope} parentId={parentId} enlace={enlace} onClose={onClose} />
    </Modal>
  );
}

interface CuerpoProps {
  scope: EnlaceScope;
  parentId: string;
  enlace: Enlace | null;
  onClose: () => void;
}

const ESTILO_CAMPO =
  'w-full rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-1 disabled:opacity-50';

function EnlaceFormCuerpo({ scope, parentId, enlace, onClose }: CuerpoProps) {
  const t = useTranslations('cedularios');
  const { translateFieldError, showError } = useCedulariosAction();
  const idBase = useId();
  const crear = useCrearEnlace({ skipErrorToast: true });
  const editar = useEditarEnlace({ skipErrorToast: true });
  const enviando = crear.isPending || editar.isPending;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<EnlaceInput>({
    resolver: zodResolver(enlaceSchema),
    defaultValues: {
      url: enlace?.url ?? '',
      titulo: enlace?.titulo ?? '',
      descripcion: enlace?.descripcion ?? '',
    },
  });

  const longitudDescripcion = (useWatch({ control, name: 'descripcion' }) ?? '').length;

  const onSubmit = handleSubmit(async (valores) => {
    const datos = {
      url: valores.url,
      titulo: valores.titulo,
      descripcion: valores.descripcion ?? '',
    };
    const resultado = enlace
      ? await editar.mutateAsync({ scope, id: enlace.id, ...datos })
      : await crear.mutateAsync({ scope, parentId, ...datos });

    if (resultado.ok) {
      onClose();
      return;
    }

    // Keep the dialog open and the typed values. Show server field errors beneath the fields.
    const campos = resultado.error.fields ?? {};
    let hayErrorDeCampo = false;
    for (const campo of CAMPOS) {
      const codigo = campos[campo];
      if (codigo) {
        hayErrorDeCampo = true;
        setError(campo, { type: 'server', message: codigo });
      }
    }
    if (!hayErrorDeCampo) showError(resultado.error);
  });

  const idUrl = `${idBase}-url`;
  const idTitulo = `${idBase}-titulo`;
  const idDescripcion = `${idBase}-descripcion`;

  const mensaje = (campo: CampoEnlace): string | undefined => {
    const codigo = errors[campo]?.message;
    return codigo ? translateFieldError(codigo) : undefined;
  };
  const errorUrl = mensaje('url');
  const errorTitulo = mensaje('titulo');
  const errorDescripcion = mensaje('descripcion');
  const claseBorde = (conError: boolean) =>
    conError
      ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]'
      : 'border-[var(--color-border)] focus:border-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={idUrl}>{t('enlaces.campos.url')}</Label>
        <Input
          id={idUrl}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t('enlaces.placeholders.url')}
          aria-invalid={errorUrl ? true : undefined}
          aria-describedby={errorUrl ? `${idUrl}-error` : undefined}
          disabled={enviando}
          {...register('url')}
        />
        {errorUrl && (
          <p id={`${idUrl}-error`} role="alert" className="text-xs text-[var(--color-error)]">
            {errorUrl}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={idTitulo}>{t('enlaces.campos.titulo')}</Label>
        <Input
          id={idTitulo}
          type="text"
          autoComplete="off"
          placeholder={t('enlaces.placeholders.titulo')}
          aria-invalid={errorTitulo ? true : undefined}
          aria-describedby={errorTitulo ? `${idTitulo}-error` : undefined}
          disabled={enviando}
          {...register('titulo')}
        />
        {errorTitulo && (
          <p id={`${idTitulo}-error`} role="alert" className="text-xs text-[var(--color-error)]">
            {errorTitulo}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={idDescripcion}>{t('enlaces.campos.descripcion')}</Label>
          <span className="text-xs text-[var(--color-text-muted)]">{t('comun.opcional')}</span>
        </div>
        <textarea
          id={idDescripcion}
          rows={3}
          placeholder={t('enlaces.placeholders.descripcion')}
          aria-invalid={errorDescripcion ? true : undefined}
          aria-describedby={
            errorDescripcion ? `${idDescripcion}-error ${idDescripcion}-contador` : `${idDescripcion}-contador`
          }
          disabled={enviando}
          className={cn(ESTILO_CAMPO, 'resize-y', claseBorde(Boolean(errorDescripcion)))}
          {...register('descripcion')}
        />
        <div className="flex items-start justify-between gap-2">
          {errorDescripcion ? (
            <p
              id={`${idDescripcion}-error`}
              role="alert"
              className="text-xs text-[var(--color-error)]"
            >
              {errorDescripcion}
            </p>
          ) : (
            <span />
          )}
          <span
            id={`${idDescripcion}-contador`}
            className="shrink-0 text-xs text-[var(--color-text-muted)]"
          >
            {t('comun.caracteres', {
              actual: longitudDescripcion,
              max: LIMITES.enlaceDescripcion,
            })}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={enviando}>
          {t('comun.cancelar')}
        </Button>
        <Button type="submit" loading={enviando}>
          {enviando ? t('comun.guardando') : t('enlaces.formulario.guardar')}
        </Button>
      </div>
    </form>
  );
}
