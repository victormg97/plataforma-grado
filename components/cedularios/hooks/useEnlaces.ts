'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { cedulariosKeys, STALE_TIME, type EnlaceScope } from '@/lib/cedularios/keys';
import { mapDbError } from '@/lib/cedularios/errors';
import type { ActionError, ActionResult } from '@/lib/cedularios/action-result';
import type { Database } from '@/lib/supabase/types';
import { fetchEnlaces, type Enlace } from '@/lib/queries/cedularios/enlaces';
import {
  crearEnlace,
  editarEnlace,
  eliminarEnlace,
  reordenarEnlaces,
} from '@/app/actions/cedularios/enlaces';
import {
  CedulariosQueryError,
  HISTORIAL_ROOT,
  consultar,
  enlacesScopeKey,
  reintentarConsulta,
} from './cedulariosQuery';
import { useAccionMutation, type CedulariosMutationOptions } from './useAccionMutation';
import { useCedulariosAction } from './useCedulariosAction';

type EnlaceRow =
  | Database['public']['Tables']['cedulario_enlaces']['Row']
  | Database['public']['Tables']['materia_enlaces']['Row'];

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Enlaces of a cedulario (`scope: 'cedulario'`, `parentId` = cedulario id) or of a materia
 * (`scope: 'materia'`, `parentId` = materia id), ordered by `orden`. Disabled while `parentId`
 * is empty. Stale after 60 s.
 */
export function useEnlaces(
  scope: EnlaceScope,
  parentId: string | null | undefined,
): UseQueryResult<Enlace[], CedulariosQueryError> {
  return useQuery<Enlace[], CedulariosQueryError>({
    queryKey: cedulariosKeys.enlaces(scope, parentId ?? ''),
    queryFn: () => consultar(() => fetchEnlaces(createClient(), scope, parentId as string)),
    enabled: Boolean(parentId),
    staleTime: STALE_TIME.enlaces,
    retry: reintentarConsulta,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CrearEnlaceInput {
  scope: EnlaceScope;
  /** Cedulario id or materia id, depending on `scope`. */
  parentId: string;
  url: string;
  titulo: string;
  descripcion?: string;
}

export interface EditarEnlaceInput {
  scope: EnlaceScope;
  id: string;
  url: string;
  titulo: string;
  descripcion?: string;
}

/** Adds an enlace at the end of the list. Variables: `CrearEnlaceInput`. */
export function useCrearEnlace(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<EnlaceRow>, Error, CrearEnlaceInput> {
  const qc = useQueryClient();
  return useAccionMutation<CrearEnlaceInput, EnlaceRow>({
    action: (input) => crearEnlace(input),
    successKey: 'enlace_creado',
    onOk: (_data, { scope, parentId }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.enlaces(scope, parentId) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/** Edits url, título and descripción. Variables: `EditarEnlaceInput`. */
export function useEditarEnlace(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<EnlaceRow>, Error, EditarEnlaceInput> {
  const qc = useQueryClient();
  return useAccionMutation<EditarEnlaceInput, EnlaceRow>({
    action: (input) => editarEnlace(input),
    successKey: 'enlace_editado',
    onOk: (_data, { scope }) => {
      void qc.invalidateQueries({ queryKey: enlacesScopeKey(scope) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/** Hard-deletes an enlace. Variables: `{ scope, id }`. */
export function useEliminarEnlace(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, { scope: EnlaceScope; id: string }> {
  const qc = useQueryClient();
  return useAccionMutation<{ scope: EnlaceScope; id: string }, void>({
    action: (input) => eliminarEnlace(input),
    successKey: 'enlace_eliminado',
    onOk: (_data, { scope }) => {
      void qc.invalidateQueries({ queryKey: enlacesScopeKey(scope) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

// ─── Reorder (optimistic) ────────────────────────────────────────────────────

interface ReordenarEnlacesContext {
  /** List cache before the optimistic reorder; `undefined` when the cache was empty. */
  snapshot: Enlace[] | undefined;
}

/**
 * Lists `lista` in the order of `ids`. Enlaces missing from `ids` keep their relative order at
 * the end. The set of `orden` values is reused in ascending order, so the list stays sorted by `orden`.
 */
function reordenarLista(lista: Enlace[], ids: readonly string[]): Enlace[] {
  const porId = new Map(lista.map((enlace) => [enlace.id, enlace]));
  const enIds = new Set(ids);
  const ordenados: Enlace[] = [];
  for (const id of ids) {
    const enlace = porId.get(id);
    if (enlace) ordenados.push(enlace);
  }
  const combinada = [...ordenados, ...lista.filter((enlace) => !enIds.has(enlace.id))];
  const ordenes = lista.map((enlace) => enlace.orden).sort((a, b) => a - b);
  return combinada.map((enlace, i) => ({ ...enlace, orden: ordenes[i] ?? enlace.orden }));
}

/**
 * Persists a new order of the enlaces of one list, with an optimistic reorder.
 * Variables: the complete list of enlace ids in the new order.
 *
 * - `onMutate`: snapshots `['cedularios','enlaces',scope,parentId]` and reorders the cache.
 * - Failure: restores the exact snapshot, then shows the error toast. On `lista_desactualizada`
 *   (the set of ids no longer matches the server) the list is also refetched.
 * - `onSettled`: invalidates the list.
 */
export function useReordenarEnlaces(
  scope: EnlaceScope,
  parentId: string | null | undefined,
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, string[], ReordenarEnlacesContext> {
  const qc = useQueryClient();
  const { run, showError } = useCedulariosAction();
  const listaKey = cedulariosKeys.enlaces(scope, parentId ?? '');

  const alFallar = (error: ActionError, contexto: ReordenarEnlacesContext | undefined) => {
    if (contexto?.snapshot !== undefined) qc.setQueryData(listaKey, contexto.snapshot);
    if (!options?.skipErrorToast) showError(error);
    if (error.code === 'lista_desactualizada') void qc.refetchQueries({ queryKey: listaKey });
  };

  return useMutation<ActionResult<void>, Error, string[], ReordenarEnlacesContext>({
    // The error toast is shown after the rollback, not by `run`.
    mutationFn: (ids) =>
      run(() => reordenarEnlaces({ scope, parentId: parentId as string, ids }), {
        skipErrorToast: true,
        successKey: options?.skipSuccessToast ? undefined : 'enlaces_reordenados',
      }),

    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: listaKey });
      const snapshot = qc.getQueryData<Enlace[]>(listaKey);
      if (snapshot) qc.setQueryData<Enlace[]>(listaKey, reordenarLista(snapshot, ids));
      return { snapshot };
    },

    onSuccess: (resultado, _ids, contexto) => {
      if (!resultado.ok) alFallar(resultado.error, contexto);
    },

    onError: (error, _ids, contexto) => {
      alFallar({ code: mapDbError(error) }, contexto);
    },

    onSettled: () => {
      // Enlace `orden` is not audited, so the historial is not invalidated.
      void qc.invalidateQueries({ queryKey: listaKey });
    },
  });
}
