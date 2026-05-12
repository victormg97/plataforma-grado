'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { calificarPruebaSchema, type CalificarPruebaData } from '@/lib/validations/prueba.schema';
import type { Prueba } from '@/lib/supabase/types';

interface PruebaCalificacionProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CalificarPruebaData) => Promise<void>;
  prueba: Prueba | null;
  loading?: boolean;
}

/** Chilean grading scale: 1.0–7.0, 4.0 is the passing threshold */
function getGradeColor(nota: number): string {
  if (nota >= 5.5) return 'text-green-600 dark:text-green-400';
  if (nota >= 4.0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function PruebaCalificacion({
  open,
  onClose,
  onSubmit,
  prueba,
  loading = false,
}: PruebaCalificacionProps) {
  const t = useTranslations('programas');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CalificarPruebaData>({
    resolver: zodResolver(calificarPruebaSchema),
    defaultValues: {
      nota: prueba?.nota ?? undefined,
      observaciones: prueba?.observaciones ?? '',
    },
  });

  useEffect(() => {
    if (open && prueba) {
      reset({
        nota: prueba.nota ?? undefined,
        observaciones: prueba.observaciones ?? '',
      });
    }
  }, [open, prueba, reset]);

  const notaVal = watch('nota');

  const handleFormSubmit = async (data: CalificarPruebaData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('calificacion.titulo')}
      description={prueba?.nombre ?? ''}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('calificacion.cancelar')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleSubmit(handleFormSubmit)}
          >
            <Star className="mr-1.5 size-4" />
            {t('calificacion.guardar')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Nota visual */}
        {notaVal !== undefined && !isNaN(Number(notaVal)) && (
          <div className="flex items-center justify-center">
            <span className={`text-5xl font-bold ${getGradeColor(Number(notaVal))}`}>
              {Number(notaVal).toFixed(1)}
            </span>
          </div>
        )}

        {/* Nota input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('calificacion.nota')}
            <span className="ml-1 text-xs text-[var(--color-text-muted)]">(1.0 – 7.0)</span>
          </label>
          <input
            {...register('nota', { valueAsNumber: true })}
            type="number"
            step="0.1"
            min="1.0"
            max="7.0"
            placeholder="4.0"
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
            onChange={(e) => {
              const raw = e.target.value;
              // Auto-insert decimal: "14" → 1.4, "56" → 5.6 (two digits, no dot, >7)
              if (/^\d{2}$/.test(raw) && !raw.includes('.') && Number(raw) > 7) {
                const transformed = parseFloat(`${raw[0]}.${raw[1]}`);
                setValue('nota', transformed, { shouldValidate: true });
                e.target.value = transformed.toFixed(1);
              } else {
                const num = parseFloat(raw);
                if (!isNaN(num)) {
                  const clamped = Math.min(7, Math.max(1, num));
                  setValue('nota', clamped, { shouldValidate: true });
                }
              }
            }}
          />
          {errors.nota && (
            <p className="text-xs text-[var(--color-error)]">{errors.nota.message}</p>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('calificacion.escala_nota')}
          </p>
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('calificacion.observaciones')}
          </label>
          <textarea
            {...register('observaciones')}
            rows={3}
            placeholder={t('calificacion.observaciones_placeholder')}
            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
          />
          {errors.observaciones && (
            <p className="text-xs text-[var(--color-error)]">{errors.observaciones.message}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
