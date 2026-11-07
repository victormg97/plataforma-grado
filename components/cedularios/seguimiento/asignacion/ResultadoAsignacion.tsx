'use client';

/**
 * Summary of a multi-student assignment.
 * Shows how many students were assigned and how many were reactivated, and the list of rejected
 * students with their reason translated through `cedularios.errores.<code>`.
 * The student names come from the caller because the action result only carries ids.
 */

import { useMemo } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ResultadoAsignacionAlumno } from '@/app/actions/cedularios/seguimiento/asignaciones';

interface ResultadoAsignacionProps {
  resultados: readonly ResultadoAsignacionAlumno[];
  /** Display name per student id. Missing ids fall back to the "unnamed student" label. */
  nombresAlumnos?: Readonly<Record<string, string>>;
  /** When set, a close button is rendered below the summary. */
  onCerrar?: () => void;
  className?: string;
}

export function ResultadoAsignacion({
  resultados,
  nombresAlumnos,
  onCerrar,
  className,
}: ResultadoAsignacionProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tErrores = useTranslations('cedularios.errores');

  const { asignados, reactivados, rechazados } = useMemo(() => {
    let nuevos = 0;
    let reasignados = 0;
    const fallidos: Extract<ResultadoAsignacionAlumno, { resultado: 'rechazado' }>[] = [];
    for (const resultado of resultados) {
      if (resultado.resultado === 'rechazado') fallidos.push(resultado);
      else if (resultado.resultado === 'reactivado') reasignados += 1;
      else nuevos += 1;
    }
    return { asignados: nuevos, reactivados: reasignados, rechazados: fallidos };
  }, [resultados]);

  const motivoTraducido = (motivo: string): string =>
    tErrores.has(motivo) ? tErrores(motivo) : t('asignar.resultado.motivo_desconocido');

  const nombreDe = (alumnoId: string): string => {
    const nombre = nombresAlumnos?.[alumnoId]?.trim();
    return nombre ? nombre : t('comun.alumno_sin_nombre');
  };

  return (
    <section
      aria-label={t('asignar.resultado.titulo')}
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {t('asignar.resultado.titulo')}
      </h3>

      <ul className="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]" role="status">
        <li className="flex items-center gap-2">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-[var(--color-success)]" />
          <span>{t('asignar.resultado.asignados', { count: asignados })}</span>
        </li>
        {reactivados > 0 && (
          <li className="flex items-center gap-2">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-[var(--color-success)]" />
            <span>{t('asignar.resultado.reactivados', { count: reactivados })}</span>
          </li>
        )}
        {rechazados.length > 0 && (
          <li className="flex items-center gap-2">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-[var(--color-error)]" />
            <span>{t('asignar.resultado.rechazados', { count: rechazados.length })}</span>
          </li>
        )}
      </ul>

      {rechazados.length > 0 && (
        <ul
          role="alert"
          className="flex max-h-48 flex-col divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]"
        >
          {rechazados.map((rechazado) => (
            <li
              key={rechazado.alumnoId}
              className="px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]"
            >
              {t('asignar.resultado.rechazado_motivo', {
                alumno: nombreDe(rechazado.alumnoId),
                motivo: motivoTraducido(rechazado.motivo),
              })}
            </li>
          ))}
        </ul>
      )}

      {onCerrar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          >
            {t('asignar.resultado.cerrar')}
          </button>
        </div>
      )}
    </section>
  );
}
