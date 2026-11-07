'use client';

/**
 * "Nota" section of the materia detail panel.
 *
 * - Edit mode: a textarea with a save button (no autosave). Validation uses `notaSchema`; a field
 *   error is shown under the textarea and the typed text is kept on any failure or refetch.
 * - Read mode: the note as plain text (always rendered as a React text child, never as HTML).
 */

import { useEffect, useId, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { MAX_NOTA } from '@/lib/cedularios/seguimiento/constants';
import { notaSchema } from '@/lib/validations/cedularioSeguimiento.schema';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import { useDetalleMutations } from '../../hooks/useDetalleMutations';

/** The form wraps the shared note schema so its error key lands on the `texto` field. */
const notaFormSchema = z.object({ texto: notaSchema });
type NotaFormInput = z.input<typeof notaFormSchema>;
type NotaFormData = z.output<typeof notaFormSchema>;

interface NotaSectionProps {
  /** Id of the assignment that owns the progress row. */
  asignacionId: string;
  /** Id of the progress row of the materia. */
  progresoId: string;
  /** Stored note of the materia, or null when there is none. */
  nota: string | null;
  /** True in edit mode; false renders the note as read-only text. */
  editable: boolean;
  className?: string;
}

export function NotaSection({
  asignacionId,
  progresoId,
  nota,
  editable,
  className,
}: NotaSectionProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.nota');
  const idBase = useId();

  return (
    <section className={cn('flex flex-col gap-2', className)} aria-labelledby={`${idBase}-titulo`}>
      <h4
        id={`${idBase}-titulo`}
        className="text-sm font-semibold text-[var(--color-text-primary)]"
      >
        {t('titulo')}
      </h4>
      {editable ? (
        <NotaFormulario
          asignacionId={asignacionId}
          progresoId={progresoId}
          nota={nota}
          idBase={idBase}
        />
      ) : nota ? (
        <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">
          {nota}
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">{t('vacia')}</p>
      )}
    </section>
  );
}

interface NotaFormularioProps {
  asignacionId: string;
  progresoId: string;
  nota: string | null;
  idBase: string;
}

function NotaFormulario({ asignacionId, progresoId, nota, idBase }: NotaFormularioProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.nota');
  const { translateFieldError } = useCedulariosAction();
  const { guardarNota } = useDetalleMutations(asignacionId, progresoId);
  const guardando = guardarNota.isPending;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<NotaFormInput, unknown, NotaFormData>({
    resolver: zodResolver(notaFormSchema),
    mode: 'onChange',
    defaultValues: { texto: nota ?? '' },
  });

  // Follow the stored note only while the user has no unsaved text, so a refetch or a realtime
  // signal never overwrites what is being typed (and a failed save keeps the typed text).
  const sucioRef = useRef(false);
  useEffect(() => {
    sucioRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    if (!sucioRef.current) reset({ texto: nota ?? '' });
  }, [nota, reset]);

  const texto = useWatch({ control, name: 'texto' }) ?? '';

  const alEnviar = (datos: NotaFormData) => {
    const guardado = datos.texto ?? '';
    guardarNota.mutate(
      { nota: guardado },
      {
        onSuccess: (resultado) => {
          // On failure the hook has already rolled back and shown the toast; the form keeps its text.
          if (resultado.ok) reset({ texto: guardado });
        },
      },
    );
  };

  const errorTexto = errors.texto?.message;
  const excedido = texto.length > MAX_NOTA;

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-2">
      <textarea
        id={`${idBase}-texto`}
        {...register('texto')}
        rows={4}
        placeholder={t('placeholder')}
        aria-label={t('aria')}
        aria-invalid={errorTexto ? 'true' : 'false'}
        aria-describedby={errorTexto ? `${idBase}-error` : `${idBase}-contador`}
        readOnly={guardando}
        className={cn(
          'w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none',
          'placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20',
          'aria-[invalid=true]:border-[var(--color-error)] read-only:opacity-70',
        )}
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
                excedido ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]',
              )}
            >
              {t('contador', { actual: texto.length, max: MAX_NOTA })}
            </p>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={guardando}
          disabled={!isDirty}
        >
          {guardando ? t('guardando') : t('guardar')}
        </Button>
      </div>
    </form>
  );
}
