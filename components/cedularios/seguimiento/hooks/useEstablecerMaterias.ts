'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/cedularios/action-result';
import {
  establecerMateriasAsignadas,
  type ResultadoSubconjunto,
} from '@/app/actions/cedularios/seguimiento/asignaciones';
import type { SubconjuntoInput } from '@/lib/validations/cedularioSeguimiento.schema';
import type { CedulariosMutationOptions } from '@/components/cedularios/hooks/useAccionMutation';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import {
  invalidarSeguimiento,
  mostrarExitoSeguimiento,
  type TraductorSeguimiento,
} from './segInvalidaciones';

export interface EstablecerMateriasVars extends SubconjuntoInput {
  /** Student of the assignment. Lets the invalidation reach only that summary. */
  alumnoId?: string;
  /** Cedulario of the assignment. Lets the invalidation reach only that student list. */
  cedularioId?: string;
}

/**
 * Edits the subset of materias of an assignment in one transaction.
 * Variables: `{ asignacionId, agregar, quitar, alumnoId?, cedularioId? }`; the last two only
 * narrow the cache invalidation. Resolves with the counters `{ agregadas, restauradas, archivadas }`.
 * Shows a success toast (5 s). Invalidates summaries, student list, progress, activity and
 * archived subjects of the assignment after success or failure.
 */
export function useEstablecerMaterias(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<ResultadoSubconjunto>, Error, EstablecerMateriasVars> {
  const qc = useQueryClient();
  const { run } = useCedulariosAction();
  const t = useTranslations('cedularios.seguimiento.toasts') as unknown as TraductorSeguimiento;

  return useMutation<ActionResult<ResultadoSubconjunto>, Error, EstablecerMateriasVars>({
    mutationFn: ({ asignacionId, agregar, quitar }) =>
      run(() => establecerMateriasAsignadas({ asignacionId, agregar, quitar }), {
        skipErrorToast: options?.skipErrorToast,
      }),

    onSuccess: (resultado) => {
      if (resultado.ok && !options?.skipSuccessToast) {
        mostrarExitoSeguimiento(t('subconjunto_guardado'));
      }
    },

    onSettled: (_resultado, _error, { asignacionId, alumnoId, cedularioId }) => {
      invalidarSeguimiento(qc, {
        alumnoIds: alumnoId ? [alumnoId] : undefined,
        cedularioId,
        asignacionIds: [asignacionId],
      });
    },
  });
}
