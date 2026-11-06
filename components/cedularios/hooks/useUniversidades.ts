'use client';

import { useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { cedulariosKeys, STALE_TIME } from '@/lib/cedularios/keys';
import type { ActionResult } from '@/lib/cedularios/action-result';
import type { UniversidadRow } from '@/lib/cedularios/contexto-accion';
import type { UniversidadInput } from '@/lib/cedularios/schemas';
import { fetchUniversidades, type Universidad } from '@/lib/queries/cedularios/universidades';
import {
  crearUniversidad,
  editarUniversidad,
  eliminarUniversidad,
  guardarLogoUniversidad,
} from '@/app/actions/cedularios/universidades';
import { CedulariosQueryError, DETALLE_ROOT, consultar, reintentarConsulta } from './cedulariosQuery';
import { useAccionMutation, type CedulariosMutationOptions } from './useAccionMutation';

// ─── Query ───────────────────────────────────────────────────────────────────

/** Universidades visible to the current user (RLS decides), ordered by nombre. Stale after 5 min. */
export function useUniversidades(): UseQueryResult<Universidad[], CedulariosQueryError> {
  return useQuery<Universidad[], CedulariosQueryError>({
    queryKey: cedulariosKeys.universidades(),
    queryFn: () => consultar(() => fetchUniversidades(createClient())),
    staleTime: STALE_TIME.universidades,
    retry: reintentarConsulta,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Creates a universidad. Variables: `UniversidadInput`. */
export function useCrearUniversidad(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<UniversidadRow>, Error, UniversidadInput> {
  const qc = useQueryClient();
  return useAccionMutation<UniversidadInput, UniversidadRow>({
    action: (input) => crearUniversidad(input),
    successKey: 'universidad_creada',
    onOk: () => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.universidades() });
    },
    options,
  });
}

/** Edits nombre and código. Variables: `{ id, input }`. */
export function useEditarUniversidad(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<UniversidadRow>, Error, { id: string; input: UniversidadInput }> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; input: UniversidadInput }, UniversidadRow>({
    action: ({ id, input }) => editarUniversidad(id, input),
    successKey: 'universidad_editada',
    onOk: () => {
      // The cedularios list embeds the universidad name.
      void qc.invalidateQueries({ queryKey: cedulariosKeys.universidades() });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
      void qc.invalidateQueries({ queryKey: DETALLE_ROOT });
    },
    options,
  });
}

/**
 * Soft-deletes a universidad. Variables: the universidad id. Fails with
 * `universidad_con_cedularios` (`error.params.count`) when it still has active cedularios.
 */
export function useEliminarUniversidad(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, string> {
  const qc = useQueryClient();
  return useAccionMutation<string, void>({
    action: (id) => eliminarUniversidad(id),
    successKey: 'universidad_eliminada',
    onOk: () => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.universidades() });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
    },
    options,
  });
}

/**
 * Stores the logo the browser already uploaded to `path` (`<universidad_id>/<file>`).
 * Variables: `{ id, path }`.
 */
export function useGuardarLogoUniversidad(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<{ logo_url: string }>, Error, { id: string; path: string }> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; path: string }, { logo_url: string }>({
    action: ({ id, path }) => guardarLogoUniversidad(id, path),
    successKey: 'logo_guardado',
    onOk: () => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.universidades() });
      void qc.invalidateQueries({ queryKey: DETALLE_ROOT });
    },
    options,
  });
}
