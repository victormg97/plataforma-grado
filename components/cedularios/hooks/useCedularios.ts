'use client';

import {
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cedulariosKeys, STALE_TIME } from '@/lib/cedularios/keys';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import type { ActionResult } from '@/lib/cedularios/action-result';
import type { CampoContenidoCedulario, CedularioRow, ResultadoEliminarCedulario } from '@/lib/cedularios/contexto-accion';
import type { CedularioListItem } from '@/lib/cedularios/busqueda';
import type { TiptapDoc } from '@/lib/cedularios/richtext';
import type { CedularioInput } from '@/lib/cedularios/schemas';
import type { Json } from '@/lib/supabase/types';
import {
  fetchCedulario,
  fetchCedularios,
  type CedularioDetalle,
} from '@/lib/queries/cedularios/cedularios';
import {
  crearCedulario,
  editarCedulario,
  eliminarCedulario,
  guardarContenidoCedulario,
} from '@/app/actions/cedularios/cedularios';
import {
  CedulariosQueryError,
  HISTORIAL_ROOT,
  consultar,
  reintentarConsulta,
} from './cedulariosQuery';
import { useAccionMutation, type CedulariosMutationOptions } from './useAccionMutation';
import { TOAST_DURATION_MS } from './useCedulariosAction';

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Skinny cedulario list (no normativa / rúbrica). Stale after 5 min. */
export function useCedularios(): UseQueryResult<CedularioListItem[], CedulariosQueryError> {
  return useQuery<CedularioListItem[], CedulariosQueryError>({
    queryKey: cedulariosKeys.lista(),
    queryFn: () => consultar(() => fetchCedularios(createClient())),
    staleTime: STALE_TIME.lista,
    retry: reintentarConsulta,
  });
}

/**
 * One cedulario with normativa and rúbrica. Resolves to `null` when it does not exist or is
 * not visible. Disabled while `id` is empty. Stale after 60 s.
 */
export function useCedulario(
  id: string | null | undefined,
): UseQueryResult<CedularioDetalle | null, CedulariosQueryError> {
  return useQuery<CedularioDetalle | null, CedulariosQueryError>({
    queryKey: cedulariosKeys.detalle(id ?? ''),
    queryFn: () => consultar(() => fetchCedulario(createClient(), id as string)),
    enabled: Boolean(id),
    staleTime: STALE_TIME.detalle,
    retry: reintentarConsulta,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Creates a cedulario. Variables: `CedularioInput`. */
export function useCrearCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<CedularioRow>, Error, CedularioInput> {
  const qc = useQueryClient();
  return useAccionMutation<CedularioInput, CedularioRow>({
    action: (input) => crearCedulario(input),
    successKey: 'cedulario_creado',
    onOk: () => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
    },
    options,
  });
}

/**
 * Edits nombre, versión, descripción and, only when present, `universidad_id`.
 * Variables: `{ id, input }`.
 */
export function useEditarCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<CedularioRow>, Error, { id: string; input: Partial<CedularioInput> }> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; input: Partial<CedularioInput> }, CedularioRow>({
    action: ({ id, input }) => editarCedulario(id, input),
    successKey: 'cedulario_editado',
    onOk: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.detalle(id) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/**
 * Soft-deletes a cedulario. Variables: `{ id, confirmado? }`.
 *
 * With active materias and `confirmado` not true nothing is deleted: the result is
 * `{ ok: true, data: { eliminado: false, requiereConfirmacion: { materias } } }`. Show the
 * confirmation dialog, then call again with `confirmado: true`. The success toast appears only
 * when `data.eliminado` is true.
 */
export function useEliminarCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<
  ActionResult<ResultadoEliminarCedulario>,
  Error,
  { id: string; confirmado?: boolean }
> {
  const qc = useQueryClient();
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  return useAccionMutation<{ id: string; confirmado?: boolean }, ResultadoEliminarCedulario>({
    action: ({ id, confirmado }) => eliminarCedulario(id, { confirmado }),
    onOk: (data, { id }) => {
      if (!data.eliminado) return;
      if (!options?.skipSuccessToast) {
        toast.success(t('toasts.cedulario_eliminado'), {
          duration: TOAST_DURATION_MS,
          dismissible: true,
          closeButton: true,
        });
      }
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
      void qc.invalidateQueries({ queryKey: cedulariosKeys.detalle(id) });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}

/**
 * Saves normativa or rúbrica. Variables: `{ id, campo, doc }`. Returns the document sanitized
 * by the server. The cached detail is patched with it (no refetch, so an open editor is not
 * disturbed). Autosave callers pass `{ skipSuccessToast: true, skipErrorToast: true }`
 * because the editor shows its own save indicator.
 */
export function useGuardarContenidoCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<
  ActionResult<TiptapDoc>,
  Error,
  { id: string; campo: CampoContenidoCedulario; doc: unknown }
> {
  const qc = useQueryClient();
  return useAccionMutation<{ id: string; campo: CampoContenidoCedulario; doc: unknown }, TiptapDoc>({
    action: ({ id, campo, doc }) => guardarContenidoCedulario(id, campo, doc),
    successKey: 'contenido_guardado',
    onOk: (saved, { id, campo }) => {
      qc.setQueryData<CedularioDetalle | null>(cedulariosKeys.detalle(id), (previo) =>
        previo ? { ...previo, [campo]: saved as unknown as Json } : previo,
      );
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista(), refetchType: 'none' });
      void qc.invalidateQueries({ queryKey: HISTORIAL_ROOT });
    },
    options,
  });
}
