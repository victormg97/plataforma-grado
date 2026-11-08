'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { TIMEOUT_OPERACION_MS } from '@/lib/cedularios/errors';
import { asignarCedularios } from '@/app/actions/cedularios/seguimiento/asignaciones';
import {
  resumirResultados,
  type ResultadoAsignacionCedulario,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { AsignarCedulariosInput } from '@/lib/validations/cedularioSeguimiento.schema';
import type { CedulariosMutationOptions } from '@/components/cedularios/hooks/useAccionMutation';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import {
  invalidarSeguimiento,
  mostrarExitoSeguimiento,
  type TraductorSeguimiento,
} from './segInvalidaciones';

/**
 * Assigns several cedularios to one student. Variables: `{ alumnoId, cedularios }` where each
 * cedulario carries its own `materias` (`'todas'` or a non-empty list of ids).
 *
 * Resolves with one result per cedulario. The assignment dialog shows the failed ones and lets
 * the user retry only those, so the error toast only appears for whole-operation failures.
 * The server runs one call per cedulario in series, so the timeout grows with their number.
 * Always invalidates the summaries and lists, even after a failure, because earlier cedularios
 * may already be committed.
 */
export function useAsignarCedularios(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<ResultadoAsignacionCedulario[]>, Error, AsignarCedulariosInput> {
  const qc = useQueryClient();
  const { run } = useCedulariosAction();
  const t = useTranslations('cedularios.seguimiento.toasts') as unknown as TraductorSeguimiento;

  return useMutation<ActionResult<ResultadoAsignacionCedulario[]>, Error, AsignarCedulariosInput>({
    mutationFn: (vars) =>
      run(() => asignarCedularios(vars), {
        skipErrorToast: options?.skipErrorToast,
        timeoutMs: TIMEOUT_OPERACION_MS * Math.max(1, vars.cedularios.length),
      }),

    onSuccess: (resultado) => {
      if (!resultado.ok || options?.skipSuccessToast) return;
      const resumen = resumirResultados(resultado.data);
      const asignados = resumen.asignados + resumen.reactivados;
      if (asignados === 0) return;
      const fallidos = resumen.fallidos.length;
      mostrarExitoSeguimiento(
        fallidos === 0
          ? t('cedularios_asignados', { count: asignados })
          : t('cedularios_asignados_parcial', { asignados, fallidos }),
      );
    },

    onSettled: (resultado, _error, vars) => {
      const asignacionIds: string[] = [];
      for (const fila of resultado?.ok ? resultado.data : []) {
        if (fila.resultado !== 'rechazado') asignacionIds.push(fila.asignacionId);
      }
      // Several cedularios changed: widen the cedulario lists to every cedulario
      invalidarSeguimiento(qc, { alumnoIds: [vars.alumnoId], asignacionIds });
    },
  });
}
