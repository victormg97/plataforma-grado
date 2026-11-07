'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { desasignarCedulario } from '@/app/actions/cedularios/seguimiento/asignaciones';
import type { CedulariosMutationOptions } from '@/components/cedularios/hooks/useAccionMutation';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';
import {
  invalidarSeguimiento,
  mostrarExitoSeguimiento,
  type TraductorSeguimiento,
} from './segInvalidaciones';

export interface DesasignarCedularioVars {
  asignacionId: string;
  /** Student of the assignment. Lets the invalidation reach only that summary. */
  alumnoId?: string;
  /** Cedulario of the assignment. Lets the invalidation reach only that student list. */
  cedularioId?: string;
}

/**
 * Unassigns a cedulario from a student (the progress is kept, see D-S2).
 * Variables: `{ asignacionId, alumnoId?, cedularioId? }`; the last two only narrow the cache
 * invalidation. Resolves with `{ cambio }` (`false` when it was already unassigned).
 * Shows a success toast (5 s). Invalidates after success or failure, so the views drop to
 * the real state of the assignment.
 */
export function useDesasignarCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<{ cambio: boolean }>, Error, DesasignarCedularioVars> {
  const qc = useQueryClient();
  const { run } = useCedulariosAction();
  const t = useTranslations('cedularios.seguimiento.toasts') as unknown as TraductorSeguimiento;

  return useMutation<ActionResult<{ cambio: boolean }>, Error, DesasignarCedularioVars>({
    mutationFn: ({ asignacionId }) =>
      run(() => desasignarCedulario({ asignacionId }), {
        skipErrorToast: options?.skipErrorToast,
      }),

    onSuccess: (resultado) => {
      if (resultado.ok && !options?.skipSuccessToast) {
        mostrarExitoSeguimiento(t('desasignado'));
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
