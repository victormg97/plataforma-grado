'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { mapDbError } from '@/lib/cedularios/errors';
import { construirAgregados } from '@/lib/cedularios/seguimiento/agregados';
import {
  aplicarLoteOptimista,
  objetivoAlternar,
  planificarCascada,
  planVacio,
  requiereConfirmacion,
  restaurarFilas,
  type PlanCascada,
} from '@/lib/cedularios/seguimiento/cascada';
import { MAX_LOTE_PROGRESO } from '@/lib/cedularios/seguimiento/constants';
import { hoyEnChile } from '@/lib/cedularios/seguimiento/fechas';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import type { Cobertura, ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import type { MateriaNodo } from '@/lib/cedularios/tree';
import {
  establecerEstadosMaterias,
  type ResultadoEstadosMaterias,
} from '@/app/actions/cedularios/seguimiento/progreso';
import { useCedulariosAction } from '@/components/cedularios/hooks/useCedulariosAction';

interface CascadaContext {
  /** Rows of the plan as they were in the cache before the optimistic update. */
  previas: ProgresoFila[];
}

/** A branch uncheck waiting for the user to confirm (it loses `perdidas` covered dates). */
export interface ConfirmacionCascada {
  perdidas: number;
}

/** Mutation scope id: batches of one assignment run serially, in order. */
const scopeLote = (asignacionId: string) => `seg-progreso-lote-${asignacionId}`;

/**
 * Parent / child coverage of the reviewer tree (one batch per click).
 *
 * `alternar(materiaId)` reads the cached progress at click time, derives the target from the
 * branch state (`objetivoAlternar`) and plans the batch with `planificarCascada` (materia,
 * descendants and assigned ancestors). Unchecking a branch that loses 2 or more covered dates
 * waits for `confirmar()`; `cancelar()` drops it. An empty plan never reaches the server.
 *
 * - `onMutate`: cancels in-flight `progreso` fetches, saves the touched rows and applies the
 *   plan to the cache (`aplicarLoteOptimista`).
 * - Failure (rejected call or failed `ActionResult`): puts the saved rows back and shows the
 *   error toast. The RPC is atomic, so nothing was written.
 * - `onSettled`: invalidates progress, summaries, student lists and activity only when no other
 *   batch of the same assignment is queued.
 */
export function useCascadaCobertura(asignacionId: string, flat: MateriaNodo[]) {
  const qc = useQueryClient();
  const { run, showError } = useCedulariosAction();
  const progresoKey = seguimientoKeys.progreso(asignacionId);
  const scopeId = scopeLote(asignacionId);

  const flatRef = useRef(flat);
  useEffect(() => {
    flatRef.current = flat;
  }, [flat]);

  const [pendiente, setPendiente] = useState<{ materiaId: string; perdidas: number } | null>(null);

  const revertir = (contexto: CascadaContext | undefined) => {
    const previas = contexto?.previas;
    if (!previas || previas.length === 0) return;
    qc.setQueryData<ProgresoFila[]>(progresoKey, (filas) =>
      filas ? restaurarFilas(filas, previas) : filas,
    );
  };

  const { mutate, isPending } = useMutation<
    ActionResult<ResultadoEstadosMaterias>,
    Error,
    PlanCascada,
    CascadaContext
  >({
    scope: { id: scopeId },
    // The error toast is shown after the rollback, not by `run`.
    mutationFn: (plan) =>
      run(
        () =>
          establecerEstadosMaterias({
            asignacionId,
            cubiertas: plan.cubiertas,
            pendientes: plan.pendientes,
          }),
        { skipErrorToast: true },
      ),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: progresoKey });
      const filas = qc.getQueryData<ProgresoFila[]>(progresoKey);
      if (!filas) return { previas: [] };
      const ids = new Set([...plan.cubiertas, ...plan.pendientes]);
      const previas = filas.filter((fila) => ids.has(fila.id));
      qc.setQueryData<ProgresoFila[]>(progresoKey, aplicarLoteOptimista(filas, plan, hoyEnChile()));
      return { previas };
    },
    onSuccess: (resultado, _plan, contexto) => {
      if (resultado.ok) return;
      revertir(contexto);
      showError(resultado.error);
    },
    onError: (error, _plan, contexto) => {
      revertir(contexto);
      showError({ code: mapDbError(error) });
    },
    onSettled: () => {
      // During `onSettled` this mutation is still counted as pending, so 1 means "last in the queue".
      const enCola = qc.isMutating({
        predicate: (mutacion) => mutacion.options.scope?.id === scopeId,
      });
      if (enCola > 1) return;
      void qc.invalidateQueries({ queryKey: progresoKey });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.resumenes() });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.alumnosTodos() });
      void qc.invalidateQueries({ queryKey: seguimientoKeys.actividad(asignacionId) });
    },
  });

  const ejecutar = useCallback(
    (plan: PlanCascada) => {
      if (planVacio(plan)) return;
      if (plan.cubiertas.length + plan.pendientes.length > MAX_LOTE_PROGRESO) {
        showError({ code: 'validacion' });
        return;
      }
      mutate(plan);
    },
    [mutate, showError],
  );

  /** Plans against the live cache, so queued clicks build on the optimistic state. */
  const planificar = useCallback(
    (materiaId: string, objetivo?: Cobertura) => {
      const progreso = qc.getQueryData<ProgresoFila[]>(seguimientoKeys.progreso(asignacionId));
      if (!progreso) return null;
      const actual = flatRef.current;
      const destino =
        objetivo ?? objetivoAlternar(construirAgregados(actual, progreso).get(materiaId));
      return {
        objetivo: destino,
        plan: planificarCascada({ flat: actual, progreso, materiaId, objetivo: destino }),
      };
    },
    [qc, asignacionId],
  );

  const alternar = useCallback(
    (materiaId: string) => {
      const resultado = planificar(materiaId);
      if (!resultado || planVacio(resultado.plan)) return;
      if (resultado.objetivo === 'pendiente' && requiereConfirmacion(resultado.plan.perdidas)) {
        setPendiente({ materiaId, perdidas: resultado.plan.perdidas });
        return;
      }
      ejecutar(resultado.plan);
    },
    [planificar, ejecutar],
  );

  const confirmar = useCallback(() => {
    if (!pendiente) return;
    setPendiente(null);
    // Re-plan at confirm time: the data may have changed while the dialog was open.
    const resultado = planificar(pendiente.materiaId, 'pendiente');
    if (resultado) ejecutar(resultado.plan);
  }, [pendiente, planificar, ejecutar]);

  const cancelar = useCallback(() => setPendiente(null), []);

  const confirmacion: ConfirmacionCascada | null = pendiente
    ? { perdidas: pendiente.perdidas }
    : null;

  return { alternar, confirmacion, confirmar, cancelar, guardando: isPending };
}
