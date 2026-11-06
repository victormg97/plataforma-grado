'use client';

import {
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { cedulariosKeys, STALE_TIME } from '@/lib/cedularios/keys';
import type { ActionResult } from '@/lib/cedularios/action-result';
import type { TiptapDoc } from '@/lib/cedularios/richtext';
import type { Database, Json } from '@/lib/supabase/types';
import {
  fetchMateria,
  fetchMateriasEstructura,
  type MateriaEstructura,
} from '@/lib/queries/cedularios/materias';
import {
  crearMateria,
  editarMateria,
  eliminarMateria,
  guardarTemario,
  restaurarMaterias,
} from '@/app/actions/cedularios/materias';
import {
  CedulariosQueryError,
  HISTORIAL_ROOT,
  MATERIAS_ROOT,
  consultar,
  reintentarConsulta,
} from './cedulariosQuery';
import { useAccionMutation, type CedulariosMutationOptions } from './useAccionMutation';

type MateriaRow = Database['public']['Tables']['materias']['Row'];

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Flat structure list of a cedulario (no temario), key `['cedularios','materias',id]`.
 * Includes inactive rows for admin; the tree functions in `lib/cedularios/tree.ts` ignore them.
 * Disabled while `cedularioId` is empty. Stale after 60 s.
 */
export function useMateriasTree(
  cedularioId: string | null | undefined,
): UseQueryResult<MateriaEstructura[], CedulariosQueryError> {
  return useQuery<MateriaEstructura[], CedulariosQueryError>({
    queryKey: cedulariosKeys.materias(cedularioId ?? ''),
    queryFn: () => consultar(() => fetchMateriasEstructura(createClient(), cedularioId as string)),
    enabled: Boolean(cedularioId),
    staleTime: STALE_TIME.estructura,
    retry: reintentarConsulta,
  });
}

/**
 * Full materia row with temario, loaded lazily. Resolves to `null` when it does not exist or is
 * not visible. Enabled only when `id` is set. Stale after 60 s.
 */
export function useMateria(
  id: string | null | undefined,
): UseQueryResult<MateriaRow | null, CedulariosQueryError> {
  return useQuery<MateriaRow | null, CedulariosQueryError>({
    queryKey: cedulariosKeys.materia(id ?? ''),
    queryFn: () => consultar(() => fetchMateria(createClient(), id as string)),
    enabled: Boolean(id),
    staleTime: STALE_TIME.materia,
    retry: reintentarConsulta,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CrearMateriaInput {
  cedulario_id: string;
  parent_id: string | null;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface EditarMateriaInput {
  codigo: string;
  nombre: string;
  descripcion?: string;
}

/** Creates a materia (appended at the end of its siblings). Variables: `CrearMateriaInput`. */
export function useCrearMateria(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<MateriaRow>, Error, CrearMateriaInput> {
  const qc = useQueryClient();
  return useAccionMutation<CrearMateriaInput, MateriaRow>({
    action: (input) => crearMateria(input),
    successKey: 'materia_creada',
    onOk: (_data, { cedulario_id }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.materias(cedulario_id) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/** Edits código, nombre and descripción. Variables: `{ id, input }`. */
export function useEditarMateria(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<MateriaRow>, Error, { id: string; input: EditarMateriaInput }> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; input: EditarMateriaInput }, MateriaRow>({
    action: ({ id, input }) => editarMateria(id, input),
    successKey: 'materia_editada',
    onOk: (row, { id }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.materias(row.cedulario_id) });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.materia(id) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/**
 * Saves the temario. Variables: `{ id, doc }`. Returns the document sanitized by the server.
 * The cached materia is patched with it (no refetch, so an open editor is not disturbed).
 * Autosave callers pass `{ skipSuccessToast: true, skipErrorToast: true }`.
 */
export function useGuardarTemario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<TiptapDoc>, Error, { id: string; doc: unknown }> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; doc: unknown }, TiptapDoc>({
    action: ({ id, doc }) => guardarTemario(id, doc),
    successKey: 'contenido_guardado',
    onOk: (saved, { id }) => {
      qc.setQueryData<MateriaRow | null>(cedulariosKeys.materia(id), (previo) =>
        previo ? { ...previo, temario: saved as unknown as Json } : previo,
      );
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/**
 * Soft-deletes a materia and its active descendants. Variables: the materia id. Resolves with
 * `{ ok: true, data: { ids } }`, the ids to pass to `useRestaurarMaterias` for undo.
 * The success toast says how many materias were deleted; pass `{ skipSuccessToast: true }`
 * when the caller shows its own undo toast.
 */
export function useEliminarMateria(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<{ ids: string[] }>, Error, string> {
  const qc = useQueryClient();
  return useAccionMutation<string, { ids: string[] }>({
    action: (id) => eliminarMateria(id),
    successKey: 'materia_eliminada',
    successParams: (data) => ({ count: data.ids.length }),
    onOk: (_data, id) => {
      void qc.invalidateQueries({ queryKey: MATERIAS_ROOT });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.materia(id) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/**
 * Restores materias soft-deleted by `useEliminarMateria` (undo). Variables: the ids it returned.
 * A código that was taken meanwhile fails with `codigo_duplicado_nivel` and the materias stay deleted.
 */
export function useRestaurarMaterias(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, string[]> {
  const qc = useQueryClient();
  return useAccionMutation<string[], void>({
    action: (ids) => restaurarMaterias(ids),
    successKey: 'materia_restaurada',
    successParams: (_data, ids) => ({ count: ids.length }),
    onOk: () => {
      void qc.invalidateQueries({ queryKey: MATERIAS_ROOT });
      void qc.invalidateQueries({ queryKey: [...cedulariosKeys.all, 'materia'] });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}
