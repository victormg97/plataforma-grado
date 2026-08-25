'use client';

/**
 * Formulario de creación/edición de una Entrada_Personal.
 * Requisitos: 3.8, 8.1, 10.2, 10.7, 10.15, 11.2, 15.1, 15.2, 15.4, 17.10
 */
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { crearEntradaPersonalSchema } from '@/lib/agenda/entradas-personales';
import type { AdvertenciaSolapamiento } from '@/lib/agenda/nucleo';
import { useConflictoLocal } from '@/lib/agenda/solapamiento';
import type { UserRol, CategoriaAgenda } from '@/lib/supabase/types';

import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { SimpleRichEditor } from '@/components/common/SimpleRichEditor';
import { AvisoSolapamiento } from '@/components/agenda/solapamiento/AvisoSolapamiento';
import { SelectorVisibilidad } from '../SelectorVisibilidad';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const CATEGORIAS: CategoriaAgenda[] = [
  'clase', 'reunion', 'estudio', 'personal',
  'administrativo', 'evento_externo', 'plazo', 'otro',
];

const COLOR_POR_CATEGORIA: Record<CategoriaAgenda, string> = {
  clase: 'var(--color-agenda-clase)',
  reunion: 'var(--color-agenda-reunion)',
  estudio: 'var(--color-agenda-estudio)',
  personal: 'var(--color-agenda-personal)',
  administrativo: 'var(--color-agenda-administrativo)',
  evento_externo: 'var(--color-agenda-evento-externo)',
  plazo: 'var(--color-agenda-plazo)',
  otro: 'var(--color-agenda-otro)',
};

interface EntradaPersonalFormData {
  titulo: string;
  fecha: string;
  hora_inicio?: string;
  hora_fin?: string;
  dia_completo: boolean;
  categoria: CategoriaAgenda;
  visibilidad: 'privada' | 'publica';
  descripcion?: string;
  nota?: string;
  lugar?: string;
  enlace_conexion?: string;
}

export interface FormularioEntradaPersonalProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
  entradaExistente?: {
    id: string;
    titulo: string;
    categoria: CategoriaAgenda;
    visibilidad: 'privada' | 'publica';
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    dia_completo: boolean;
    descripcion: string | null;
    nota: string | null;
    lugar: string | null;
    enlace_conexion: string | null;
  } | null;
  rol: UserRol;
  onSuccess: () => void;
  /** When 'inline', renders form content without its own Modal wrapper. */
  renderMode?: 'modal' | 'inline';
  /** Callback to report dirty state to parent (used in inline mode). */
  onDirtyChange?: (dirty: boolean) => void;
}

export function FormularioEntradaPersonal({
  open, onClose, defaultDate, defaultTime, defaultEndTime,
  entradaExistente, rol, onSuccess, renderMode = 'modal', onDirtyChange,
}: FormularioEntradaPersonalProps) {
  const t = useTranslations('agendaEntradasPersonales');
  const tNucleo = useTranslations('agendaNucleo');
  const tConexion = useTranslations('agendaConexion');
  const tVis = useTranslations('agendaVisibilidad');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!entradaExistente;

  // ─── Custom dirty tracking: ignores programmatic setValue / reset ───
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const isResettingRef = useRef(false);
  const handleFormInteraction = useCallback(() => {
    if (!hasUserInteracted && !isResettingRef.current) setHasUserInteracted(true);
  }, [hasUserInteracted]);

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } =
    useForm<EntradaPersonalFormData>({
      resolver: zodResolver(crearEntradaPersonalSchema) as never,
      defaultValues: {
        titulo: '', fecha: '', hora_inicio: undefined, hora_fin: undefined,
        dia_completo: false, categoria: 'otro', visibilidad: 'privada',
        descripcion: '', nota: '', lugar: '', enlace_conexion: '',
      },
    });

  const diaCompleto = watch('dia_completo');
  const fecha = watch('fecha');
  const horaInicio = watch('hora_inicio');
  const horaFin = watch('hora_fin');

  // Report dirty state to parent (inline mode)
  useEffect(() => {
    onDirtyChange?.(hasUserInteracted);
  }, [hasUserInteracted, onDirtyChange]);

  useEffect(() => {
    if (!open) return;
    isResettingRef.current = true;
    setHasUserInteracted(false);
    if (entradaExistente) {
      reset({
        titulo: entradaExistente.titulo, fecha: entradaExistente.fecha,
        hora_inicio: entradaExistente.hora_inicio, hora_fin: entradaExistente.hora_fin,
        dia_completo: entradaExistente.dia_completo, categoria: entradaExistente.categoria,
        visibilidad: entradaExistente.visibilidad,
        descripcion: entradaExistente.descripcion ?? '',
        nota: entradaExistente.nota ?? '',
        lugar: entradaExistente.lugar ?? '',
        enlace_conexion: entradaExistente.enlace_conexion ?? '',
      });
    } else {
      const endTime = defaultEndTime ?? (defaultTime
        ? `${String(Math.min(Number(defaultTime.split(':')[0]) + 1, 23)).padStart(2, '0')}:${defaultTime.split(':')[1]}`
        : undefined);
      reset({
        titulo: '', fecha: defaultDate ?? '',
        hora_inicio: defaultTime ?? undefined, hora_fin: endTime ?? undefined,
        dia_completo: false, categoria: 'otro', visibilidad: 'privada',
        descripcion: '', nota: '', lugar: '', enlace_conexion: '',
      });
    }
    setTimeout(() => { isResettingRef.current = false; }, 50);
  }, [open, entradaExistente, defaultDate, defaultTime, defaultEndTime, reset]);

  // TODO Fase 4: obtener elementos del calendario para useConflictoLocal
  const [elementos] = useState<AdvertenciaSolapamiento[]>([]);

  const candidato = useMemo(() => ({
    id: entradaExistente?.id ?? 'nuevo',
    fecha: fecha ?? '',
    hora_inicio: diaCompleto ? '00:00' : (horaInicio ?? ''),
    hora_fin: diaCompleto ? '23:59' : (horaFin ?? ''),
  }), [entradaExistente?.id, fecha, horaInicio, horaFin, diaCompleto]);

  const modoSolapamiento = rol === 'alumno' ? 'bloqueante' : 'advertencia';
  const { conflictos, guardadoDeshabilitado } = useConflictoLocal(candidato, elementos, modoSolapamiento);

  async function onSubmit(data: EntradaPersonalFormData) {
    try {
      const url = isEditing
        ? `/api/agenda/entradas-personales/${entradaExistente!.id}`
        : '/api/agenda/entradas-personales';
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 409) { toast.error(t('error_guardar')); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.mensajeKey ?? t('error_guardar'));
      }
      toast.success(isEditing ? t('exito_editado') : t('exito_creado'));
      queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error_guardar'));
    }
  }

  const categoriaOptions = useMemo(() => CATEGORIAS.map((cat) => ({
    value: cat,
    label: tNucleo(`categorias.${cat}`),
    icon: (
      <span
        className="inline-block size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: COLOR_POR_CATEGORIA[cat] }}
      />
    ),
  })), [tNucleo]);

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]';

  const footerContent = (
    <div className="flex w-full items-center justify-end gap-3">
      <Button variant="ghost" onClick={onClose}>{tc('cancelar')}</Button>
      <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={guardadoDeshabilitado}>
        {isEditing ? t('btn_guardar') : t('btn_crear')}
      </Button>
    </div>
  );

  const formContent = (
    <form className="space-y-4" onChangeCapture={handleFormInteraction} onInputCapture={handleFormInteraction}>
      {/* Título */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_titulo')}
        </label>
        <input type="text" {...register('titulo')} placeholder={t('campo_titulo_placeholder')} className={inputClass} />
        {errors.titulo && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.titulo.message}</p>}
      </div>

      {/* Categoría */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_categoria')}
        </label>
        <Controller
          control={control}
          name="categoria"
          render={({ field }) => (
            <AppSelect value={field.value} onChange={(v) => { handleFormInteraction(); field.onChange(v); }} options={categoriaOptions} className="w-full" />
          )}
        />
      </div>

      {/* Día completo */}
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
        <Label htmlFor="dia_completo_ep" className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">
          {t('campo_dia_completo')}
        </Label>
        <Controller
          control={control}
          name="dia_completo"
          render={({ field }) => (
            <Switch
              id="dia_completo_ep"
              checked={field.value}
              onCheckedChange={(checked) => { handleFormInteraction(); field.onChange(checked); }}
            />
          )}
        />
      </div>

      {/* Fecha */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {tNucleo('campo_fecha')}
        </label>
        <input type="date" {...register('fecha')} className={inputClass} />
        {errors.fecha && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.fecha.message}</p>}
      </div>

      {/* Hora inicio / Hora fin */}
      {!diaCompleto && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {tNucleo('campo_hora_inicio')}
            </label>
            <input type="time" {...register('hora_inicio')} className={inputClass} />
            {errors.hora_inicio && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_inicio.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {tNucleo('campo_hora_fin')}
            </label>
            <input type="time" {...register('hora_fin')} className={inputClass} />
            {errors.hora_fin && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_fin.message}</p>}
          </div>
        </div>
      )}

      {/* Descripción — SimpleRichEditor SIN maxLength ni contador (Req 10.15) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_descripcion')}
        </label>
        <Controller
          control={control}
          name="descripcion"
          render={({ field }) => (
            <SimpleRichEditor content={field.value ?? ''} onChange={(v) => { handleFormInteraction(); field.onChange(v); }} placeholder={t('campo_descripcion_placeholder')} />
          )}
        />
      </div>

      {/* Nota — SimpleRichEditor SIN maxLength (Req 10.15) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_nota')}
        </label>
        <Controller
          control={control}
          name="nota"
          render={({ field }) => (
            <SimpleRichEditor content={field.value ?? ''} onChange={(v) => { handleFormInteraction(); field.onChange(v); }} placeholder={t('campo_nota_placeholder')} />
          )}
        />
      </div>

      {/* Lugar */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_lugar')}
        </label>
        <input type="text" {...register('lugar')} placeholder={t('campo_lugar_placeholder')} className={inputClass} />
        {errors.lugar && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.lugar.message}</p>}
      </div>

      {/* Enlace de conexión */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {tConexion('campo_label')}
        </label>
        <input type="url" {...register('enlace_conexion')} placeholder={tConexion('campo_placeholder')} className={inputClass} />
        {errors.enlace_conexion && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.enlace_conexion.message}</p>}
      </div>

      {/* Visibilidad */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
          {tVis('label')}
        </label>
        <Controller
          control={control}
          name="visibilidad"
          render={({ field }) => <SelectorVisibilidad value={field.value} onChange={(v) => { handleFormInteraction(); field.onChange(v); }} />}
        />
      </div>

      {/* Aviso de solapamiento */}
      <AvisoSolapamiento conflictos={conflictos} modo={modoSolapamiento} />
    </form>
  );

  // Inline mode: render form + footer without Modal wrapper
  if (renderMode === 'inline') {
    return (
      <div className="flex flex-col">
        <div className="flex-1">{formContent}</div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">{footerContent}</div>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('titulo_editar') : t('titulo_crear')}
      footer={footerContent}
    >
      {formContent}
    </Modal>
  );
}
