'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { TIMEOUT_OPERACION_MS } from '@/lib/cedularios/errors';
import { ALUMNOS_POR_LLAMADA } from '@/lib/cedularios/seguimiento/constants';
import {
  asignarCedulario,
  type ResultadoAsignacionAlumno,
} from '@/app/actions/cedularios/seguimiento/asignaciones';
import type { AsignarInput } from '@/lib/validations/cedularioSeguimiento.schema';
import type { CedulariosMutationOptions } from '@/components/cedularios/hooks/useAccionMutation';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import {
  invalidarSeguimiento,
  mostrarExitoSeguimiento,
  type TraductorSeguimiento,
} from './segInvalidaciones';

/**
 * Assigns a cedulario to one or more students. Variables: `{ cedularioId, alumnoIds, materias }`
 * where `materias` is `'todas'` or a non-empty list of materia ids.
 *
 * Resolves with the `ActionResult` whose data has one entry per student
 * (`asignado`, `reactivado` or `rechazado` with a reason). The caller (the assignment dialog)
 * shows the rejected students, so the error toast only appears for whole-operation failures.
 *
 * - The server splits the students in chunks that run in series, so the timeout grows with
 *   the number of chunks.
 * - Success toast (5 s) when at least one student was assigned; a partial summary when some
 *   were rejected.
 * - Always invalidates the summaries, student lists and selectors, even after a failure,
 *   because earlier chunks may already be committed.
 */
export function useAsignarCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<ResultadoAsignacionAlumno[]>, Error, AsignarInput> {
  const qc = useQueryClient();
  const { run } = useCedulariosAction();
  const t = useTranslations('cedularios.seguimiento.toasts') as unknown as TraductorSeguimiento;

  return useMutation<ActionResult<ResultadoAsignacionAlumno[]>, Error, AsignarInput>({
    mutationFn: (vars) => {
      const bloques = Math.max(1, Math.ceil(vars.alumnoIds.length / ALUMNOS_POR_LLAMADA));
      return run(() => asignarCedulario(vars), {
        skipErrorToast: options?.skipErrorToast,
        timeoutMs: TIMEOUT_OPERACION_MS * bloques,
      });
    },

    onSuccess: (resultado) => {
      if (!resultado.ok || options?.skipSuccessToast) return;
      const asignados = resultado.data.filter((r) => r.resultado !== 'rechazado').length;
      const rechazados = resultado.data.length - asignados;
      if (asignados === 0) return;
      mostrarExitoSeguimiento(
        rechazados === 0
          ? t('asignado', { count: asignados })
          : t('asignado_parcial', { asignados, rechazados }),
      );
    },

    onSettled: (resultado, _error, vars) => {
      const asignacionIds: string[] = [];
      for (const fila of resultado?.ok ? resultado.data : []) {
        if (fila.resultado !== 'rechazado') asignacionIds.push(fila.asignacionId);
      }
      invalidarSeguimiento(qc, {
        alumnoIds: vars.alumnoIds,
        cedularioId: vars.cedularioId,
        asignacionIds,
      });
    },
  });
}
