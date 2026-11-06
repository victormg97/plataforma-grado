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
import {
  fetchColaboradores,
  fetchCreadorCedulario,
  type Colaborador,
  type CreadorCedulario,
} from '@/lib/queries/cedularios/permisos';
import {
  listarProfesoresDisponibles,
  otorgarPermiso,
  revocarPermiso,
  type PermisoOtorgado,
  type ProfesorDisponibleAccion,
} from '@/app/actions/cedularios/permisos';
import {
  CedulariosQueryError,
  HISTORIAL_ROOT,
  consultar,
  reintentarConsulta,
} from './cedulariosQuery';
import { useAccionMutation, type CedulariosMutationOptions } from './useAccionMutation';
import { useCedulariosAction } from './useCedulariosAction';

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Collaborators of a cedulario (profesor id, nombre, apellido), through the `listar_colaboradores`
 * RPC. Only admin and profesor can read it. Disabled while `cedularioId` is empty. Stale after 60 s.
 */
export function usePermisos(
  cedularioId: string | null | undefined,
): UseQueryResult<Colaborador[], CedulariosQueryError> {
  return useQuery<Colaborador[], CedulariosQueryError>({
    queryKey: cedulariosKeys.permisos(cedularioId ?? ''),
    queryFn: () => consultar(() => fetchColaboradores(createClient(), cedularioId as string)),
    enabled: Boolean(cedularioId),
    staleTime: STALE_TIME.permisos,
    retry: reintentarConsulta,
  });
}

/**
 * Creator of a cedulario (id, nombre, apellido), through the `obtener_creador_cedulario` RPC (a
 * DEFINER function: profesores cannot read other profiles with RLS). `null` data means the creator
 * is unknown. The creator never changes, so no Realtime invalidation is needed. Disabled while
 * `cedularioId` is empty or `enabled` is false. Stale after 60 s.
 */
export function useCreadorCedulario(
  cedularioId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<CreadorCedulario | null, CedulariosQueryError> {
  return useQuery<CreadorCedulario | null, CedulariosQueryError>({
    queryKey: cedulariosKeys.creador(cedularioId ?? ''),
    queryFn: () => consultar(() => fetchCreadorCedulario(createClient(), cedularioId as string)),
    enabled: Boolean(cedularioId) && (opciones.enabled ?? true),
    staleTime: STALE_TIME.permisos,
    retry: reintentarConsulta,
  });
}

/**
 * Profesores that can still be added to the cedulario (everyone except the creator and the current
 * collaborators). Calls the `listarProfesoresDisponibles` Server Action through the action wrapper
 * (30 s timeout), without an error toast: the failure is exposed as the query error, with a
 * `CedulariosQueryError.code`. Its key sits under `permisos(cedularioId)`, so granting or revoking
 * a permission refreshes it too.
 *
 * Pass `{ enabled: open }` to load the list only while the add dialog is open.
 */
export function useProfesoresDisponibles(
  cedularioId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<ProfesorDisponibleAccion[], CedulariosQueryError> {
  const { run } = useCedulariosAction();
  return useQuery<ProfesorDisponibleAccion[], CedulariosQueryError>({
    queryKey: [...cedulariosKeys.permisos(cedularioId ?? ''), 'disponibles'],
    queryFn: async () => {
      const resultado = await run(() => listarProfesoresDisponibles(cedularioId as string), {
        skipErrorToast: true,
      });
      if (!resultado.ok) throw new CedulariosQueryError(resultado.error.code, resultado.error);
      return resultado.data;
    },
    enabled: Boolean(cedularioId) && (opciones.enabled ?? true),
    staleTime: STALE_TIME.permisos,
    retry: reintentarConsulta,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface PermisoVars {
  cedularioId: string;
  profesorId: string;
}

/**
 * Grants edit permission to a profesor. Variables: `{ cedularioId, profesorId }`. Fails with
 * `colaborador_no_profesor`, `colaborador_es_creador`, `permiso_duplicado` or `sin_permisos`.
 */
export function useOtorgarPermiso(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<PermisoOtorgado>, Error, PermisoVars> {
  const qc = useQueryClient();
  return useAccionMutation<PermisoVars, PermisoOtorgado>({
    action: (input) => otorgarPermiso(input),
    successKey: 'colaborador_agregado',
    onOk: (_data, { cedularioId }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.permisos(cedularioId) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/** Revokes a collaborator. Variables: `{ cedularioId, profesorId }`. */
export function useRevocarPermiso(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<void>, Error, PermisoVars> {
  const qc = useQueryClient();
  return useAccionMutation<PermisoVars, void>({
    action: (input) => revocarPermiso(input),
    successKey: 'colaborador_quitado',
    onOk: (_data, { cedularioId }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.permisos(cedularioId) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}
