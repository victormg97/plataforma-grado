'use client';

import { useId, useState, type FormEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import type { CedularioListItem } from '@/lib/cedularios/busqueda';
import { LIMITES, cedularioSchema, type CedularioData, type CedularioInput } from '@/lib/cedularios/schemas';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosAction } from '../hooks/useCedulariosAction';

const CLASE_INPUT =
  'h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)]';

const SIN_DESTINO = '';

export interface DatosMetadatos {
  cedulario: CedularioData;
  /** Existing empty cedulario to fill, or null to create a new one. */
  cedularioId: string | null;
}

export interface ValoresIniciales {
  universidadId: string;
  nombre: string;
  version: string;
}

interface MetadatosFormProps {
  formId: string;
  iniciales: ValoresIniciales;
  universidades: readonly Universidad[];
  cedularios: readonly CedularioListItem[];
  disabled: boolean;
  onSubmit: (datos: DatosMetadatos) => void;
}

/** Name / version / universidad of the new cedulario, or an existing empty cedulario to fill. */
export function MetadatosForm({ formId, iniciales, universidades, cedularios, disabled, onSubmit }: MetadatosFormProps) {
  const t = useTranslations('cedularios');
  const { translateFieldError } = useCedulariosAction();
  const prefijo = useId();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CedularioInput, unknown, CedularioData>({
    resolver: zodResolver(cedularioSchema),
    defaultValues: {
      universidad_id: iniciales.universidadId,
      nombre: iniciales.nombre,
      version: iniciales.version,
      descripcion: '',
    },
  });
  const universidadActual = useWatch({ control, name: 'universidad_id' });

  // The target lives outside the zod schema: it is a plain controlled value.
  const [destino, setDestino] = useState<string>(SIN_DESTINO);

  const opcionesUniversidad = universidades
    .filter((u) => u.activo || u.id === universidadActual)
    .map((u) => ({ value: u.id, label: u.nombre }));
  const candidatos = cedularios.filter((c) => c.activo && c.universidadId === universidadActual);
  const opcionesDestino = [
    { value: SIN_DESTINO, label: t('importacion.metadatos.destino_nuevo') },
    ...candidatos.map((c) => ({
      value: c.id,
      label: c.version.trim() !== '' ? `${c.nombre} (${c.version})` : c.nombre,
    })),
  ];
  const destinoEfectivo = candidatos.some((c) => c.id === destino) ? destino : SIN_DESTINO;
  const existente = candidatos.find((c) => c.id === destinoEfectivo) ?? null;

  const mensaje = (campo: keyof CedularioInput): string | undefined => {
    const m = errors[campo]?.message;
    return m ? translateFieldError(String(m)) : undefined;
  };

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (existente) {
      onSubmit({
        cedulario: {
          universidad_id: existente.universidadId,
          nombre: existente.nombre,
          version: existente.version,
          descripcion: '',
        },
        cedularioId: existente.id,
      });
      return;
    }
    void handleSubmit((valores) => onSubmit({ cedulario: valores, cedularioId: null }))(evento);
  };

  return (
    <form id={formId} onSubmit={alEnviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefijo}-universidad`} className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('cedularios.campos.universidad')}{' '}
          <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
        </label>
        <Controller
          control={control}
          name="universidad_id"
          render={({ field }) => (
            <AppSelect
              id={`${prefijo}-universidad`}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setDestino(SIN_DESTINO);
              }}
              options={opcionesUniversidad}
              placeholder={t('cedularios.placeholders.universidad')}
              className={mensaje('universidad_id') ? 'w-full !border-[var(--color-error)]' : 'w-full'}
              disabled={disabled}
            />
          )}
        />
        {mensaje('universidad_id') && (
          <p role="alert" className="text-xs text-[var(--color-error)]">{mensaje('universidad_id')}</p>
        )}
        {iniciales.universidadId === '' && (
          <p className="text-xs text-[var(--color-text-muted)]">{t('importacion.metadatos.universidad_no_detectada')}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefijo}-destino`} className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('importacion.metadatos.destino')}
        </label>
        <AppSelect
          id={`${prefijo}-destino`}
          value={destinoEfectivo}
          onChange={setDestino}
          options={opcionesDestino}
          className="w-full"
          disabled={disabled || universidadActual === ''}
        />
        <p className="text-xs text-[var(--color-text-muted)]">{t('importacion.metadatos.destino_ayuda')}</p>
      </div>

      {existente === null && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${prefijo}-nombre`} className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('cedularios.campos.nombre')}{' '}
              <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
            </label>
            <input
              id={`${prefijo}-nombre`}
              {...register('nombre')}
              className={CLASE_INPUT}
              placeholder={t('cedularios.placeholders.nombre')}
              autoComplete="off"
              maxLength={LIMITES.cedularioNombre + 50}
              aria-required="true"
              aria-invalid={mensaje('nombre') ? 'true' : 'false'}
              readOnly={disabled}
            />
            {mensaje('nombre') && (
              <p role="alert" className="text-xs text-[var(--color-error)]">{mensaje('nombre')}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${prefijo}-version`} className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('cedularios.campos.version')}{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">({t('comun.opcional')})</span>
            </label>
            <input
              id={`${prefijo}-version`}
              {...register('version')}
              className={CLASE_INPUT}
              placeholder={t('cedularios.placeholders.version')}
              autoComplete="off"
              maxLength={LIMITES.cedularioVersion + 20}
              aria-invalid={mensaje('version') ? 'true' : 'false'}
              readOnly={disabled}
            />
            {mensaje('version') && (
              <p role="alert" className="text-xs text-[var(--color-error)]">{mensaje('version')}</p>
            )}
          </div>
        </>
      )}
      {existente !== null && (
        <p className="text-sm text-[var(--color-text-secondary)]" role="status">
          {t('importacion.metadatos.destino_usa_existente', { nombre: existente.nombre })}
        </p>
      )}
    </form>
  );
}

