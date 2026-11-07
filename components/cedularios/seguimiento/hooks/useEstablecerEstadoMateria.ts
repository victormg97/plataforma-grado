'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { mapDbError } from '@/lib/cedularios/errors';
import { hoyEnChile } from '@/lib/cedularios/seguimiento/fechas';
import { scopeProgreso, seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import {
  aplicarEstadoOptimista,
  restaurarFila,
} from '@/lib/cedularios/seguimiento/progreso-optimista';
import type { Cobertura, ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import {
  establecerEstadoMateria,
  type ResultadoEstadoMateria,
} from '@/app/actions/cedularios/seguimiento/progreso';
import type { CedulariosMutationOptions } from '@/components/cedularios/hooks/useAccionMutation';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';

/** Desired coverage. It is absolute, never a toggle, so a queue of calls converges to the last one. */
export interface EstablecerEstadoVars {
  estado: Cobertura;
  /** 'yyyy-MM-dd', not later than today. Only meaningful for `cubierta`. */
  fecha?: string;
}

interface EstablecerEstadoContext {
  /** Row as it was in the cache before this optimistic update; `undefined` when not cached. */
  previa: ProgresoFila | undefined;
}

/**
 * Sets the coverage of one materia of a student with an optimistic update and a per-row queue.
 *
 * One hook instance per progress row: the mutation scope is `seg-progreso-<progresoId>`, so
 * calls on the same row run in series and in order (any instance with the same row shares the
 * queue), while different rows run in parallel.
 *
 * - `onMutate` (runs at once, before the queue): cancels in-flight `progreso` fetches, saves
 *   the previous row and applies the desired state to the cache.
 * - Failure (rejected call or failed `ActionResult`): puts back only that row with
 *   `restaurarFila`, then shows the error toast. The other rows are not touched.
 * - `onSettled`: invalidates `progreso`, the student summaries and student lists only when no
 *   other call of the same row is left in the queue, so intermediate refetches do not
 *   overwrite the optimistic state of the calls still waiting.
 *
 * No success toast: marking progress is a quick, frequent action.
 */
export function useEstablecerEstadoMateria(
  asignacionId: string,
  progresoId: string,
  options?: CedulariosMutationOptions,
): UseMutationResult<
  ActionResult<ResultadoEstadoMateria>,
  Error,
  EstablecerEstadoVars,
  EstablecerEstadoContext
> {
  const qc = useQueryClient();
  const { run, showError } = useCedulariosAction();
  const progresoKey = seguimientoKeys.progreso(asignacionId);
  const scopeId = scopeProgreso(progresoId);

  const revertir = (contexto: EstablecerEstadoContext | undefined) => {
    const previa = contexto?.previa;
    if (!previa) return;
    qc.setQueryData<ProgresoFila[]>(progresoKey, (filas) =>
      filas ? restaurarFila(filas, previa) : filas,
    );
  };

  return useMutation<
    ActionResult<ResultadoEstadoMateria>,
    Error,
    EstablecerEstadoVars,
    EstablecerEstadoContext
  >({
    scope: { id: scopeId },

    // The error toast is shown after the rollback, not by `run`.
    mutationFn: ({ estado, fecha }) =>
      run(() => establecerEstadoMateria({ progresoId, estado, fecha }), {
        skipErrorToast: true,
      }),

    onMutate: async ({ estado, fecha }) => {
      await qc.cancelQueries({ queryKey: progresoKey });
      const filas = qc.getQueryData<ProgresoFila[]>(progresoKey);
      const previa = filas?.find((fila) => fila.id === progresoId);
      if (filas) {
        qc.setQueryData<ProgresoFila[]>(
          progresoKey,
          aplicarEstadoOptimista(filas, progresoId, estado, fecha ?? null, hoyEnChile()),
        );
      }
      return { previa };
    },

    onSuccess: (resultado, _vars, contexto) => {
      if (resultado.ok) return;
      revertir(contexto);
      if (!options?.skipErrorToast) showError(resultado.error);
    },

    onError: (error, _vars, contexto) => {
      revertir(contexto);
      if (!options?.skipErrorToast) showError({ code: mapDbError(error) });
    },

    onSettled: () => {
      // During `onSettled` this mutation is still counted as pending, so 1 means "last in the queue".
      const pendientes = qc.isMutating({
        predicate: (mutacion) => mutacion.options.scope?.id === scopeId,
      });
      if (pendientes > 1) return;

      void qc.invalidateQueries({ queryKey: progresoKey });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.resumenes() });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.alumnosTodos() });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.actividad(asignacionId) });
    },
  });
}
