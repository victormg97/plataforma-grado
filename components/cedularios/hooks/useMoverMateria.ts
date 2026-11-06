'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { cedulariosKeys } from '@/lib/cedularios/keys';
import { mapDbError } from '@/lib/cedularios/errors';
import { aplicarMovimiento, type Movimiento } from '@/lib/cedularios/tree';
import type { ActionResult } from '@/lib/cedularios/action-result';
import type { MateriaEstructura } from '@/lib/queries/cedularios/materias';
import { moverMateria } from '@/app/actions/cedularios/materias';
import { HISTORIAL_ROOT } from './cedulariosQuery';
import type { CedulariosMutationOptions } from './useAccionMutation';
import { useCedulariosAction } from './useCedulariosAction';

/** Same arguments as the `mover_materia` RPC: `despuesDeId` null = first position under the parent. */
export type MoverMateriaVars = Movimiento;

interface MoverMateriaContext {
  /** Structure cache before the optimistic move; `undefined` when the cache was empty. */
  snapshot: MateriaEstructura[] | undefined;
}

/**
 * Moves a materia (drag and drop, or the row menu: up, down, indent, outdent) with an
 * optimistic update (Req 16.3).
 *
 * - `onMutate`: cancels in-flight structure fetches, snapshots the cache at
 *   `['cedularios','materias',cedularioId]` and applies `aplicarMovimiento`, so the moved row
 *   is in the cache immediately.
 * - Failure (a rejected call or a failed `ActionResult`): restores the exact snapshot first and
 *   only then shows the error toast (`nivel_maximo`, `ciclo`, `codigo_duplicado_nivel`, ...).
 * - `onSettled`: invalidates the structure key (and the historial), so the server order wins.
 *
 * Variables: `{ id, nuevoParentId, despuesDeId }`. Resolves with the `ActionResult`.
 */
export function useMoverMateria(
  cedularioId: string | null | undefined,
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, MoverMateriaVars, MoverMateriaContext> {
  const qc = useQueryClient();
  const { run, showError } = useCedulariosAction();
  const estructuraKey = cedulariosKeys.materias(cedularioId ?? '');

  const restaurar = (contexto: MoverMateriaContext | undefined) => {
    if (contexto?.snapshot !== undefined) qc.setQueryData(estructuraKey, contexto.snapshot);
  };

  return useMutation<ActionResult<void>, Error, MoverMateriaVars, MoverMateriaContext>({
    // The error toast is shown after the rollback, not by `run`.
    mutationFn: (vars) =>
      run(() => moverMateria(vars), {
        skipErrorToast: true,
        successKey: options?.skipSuccessToast ? undefined : 'materia_movida',
      }),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: estructuraKey });
      const snapshot = qc.getQueryData<MateriaEstructura[]>(estructuraKey);
      if (snapshot) {
        // `aplicarMovimiento` spreads each node, so the extra fields of MateriaEstructura survive.
        qc.setQueryData<MateriaEstructura[]>(
          estructuraKey,
          aplicarMovimiento(snapshot, vars) as MateriaEstructura[],
        );
      }
      return { snapshot };
    },

    onSuccess: (resultado, _vars, contexto) => {
      if (resultado.ok) return;
      restaurar(contexto);
      if (!options?.skipErrorToast) showError(resultado.error);
    },

    onError: (error, _vars, contexto) => {
      restaurar(contexto);
      if (!options?.skipErrorToast) showError({ code: mapDbError(error) });
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: estructuraKey });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
  });
}
