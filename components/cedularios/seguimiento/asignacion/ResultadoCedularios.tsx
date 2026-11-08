'use client';

/**
 * Result of assigning several cedularios to one student, one line per cedulario.
 * Cedularios that failed can be retried alone with "Retry failed"; the ones that went through
 * are not sent again. A cedulario the student already had is reported as such, not as an error.
 */

import { CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import {
  MOTIVO_YA_ASIGNADO,
  type ResultadoAsignacionCedulario,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';

interface ResultadoCedulariosProps {
  resultados: readonly ResultadoAsignacionCedulario[];
  /** Display name per cedulario id. */
  nombresCedularios: Readonly<Record<string, string>>;
  onReintentar: () => void;
  onCerrar: () => void;
  className?: string;
}

export function ResultadoCedularios({
  resultados,
  nombresCedularios,
  onReintentar,
  onCerrar,
  className,
}: ResultadoCedulariosProps) {
  const t = useTranslations('cedularios.seguimiento.asignar.wizard');
  const tErrores = useTranslations('cedularios.errores');
  const tComun = useTranslations('cedularios.seguimiento.comun');

  const hayFallidos = resultados.some(
    (fila) => fila.resultado === 'rechazado' && fila.motivo !== MOTIVO_YA_ASIGNADO,
  );

  const etiqueta = (fila: ResultadoAsignacionCedulario): { texto: string; ok: boolean } => {
    if (fila.resultado === 'asignado') return { texto: t('resultado_asignado'), ok: true };
    if (fila.resultado === 'reactivado') return { texto: t('resultado_reactivado'), ok: true };
    if (fila.resultado !== 'rechazado') return { texto: t('resultado_asignado'), ok: true };
    if (fila.motivo === MOTIVO_YA_ASIGNADO) return { texto: t('resultado_ya_asignado'), ok: true };
    return {
      texto: tErrores.has(fila.motivo) ? tErrores(fila.motivo) : t('resultado_fallido'),
      ok: false,
    };
  };

  return (
    <section aria-label={t('resultado_titulo')} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('resultado_titulo')}</h3>

      <ul
        role={hayFallidos ? 'alert' : 'status'}
        className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]"
      >
        {resultados.map((fila) => {
          const { texto, ok } = etiqueta(fila);
          const Icono = ok ? CircleCheck : CircleAlert;
          return (
            <li
              key={fila.cedularioId}
              className="flex items-start gap-2 px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]"
            >
              <Icono
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{nombresCedularios[fila.cedularioId] ?? '—'}</span>
                <span className="text-[var(--color-text-muted)]">: {texto}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end gap-2">
        {hayFallidos && (
          <Button type="button" variant="secondary" onClick={onReintentar}>
            {t('reintentar_fallidos')}
          </Button>
        )}
        <Button type="button" variant={hayFallidos ? 'ghost' : 'secondary'} onClick={onCerrar}>
          {tComun('cerrar')}
        </Button>
      </div>
    </section>
  );
}
