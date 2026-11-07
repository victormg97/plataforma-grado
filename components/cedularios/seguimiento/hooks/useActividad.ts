'use client';

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import {
  fetchActividad,
  type ActividadCursor,
  type ActividadItem,
  type ActividadPage,
} from '@/lib/queries/cedularios/seguimiento/actividad';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';

/** `data.pages` as returned by React Query, plus every loaded entry in one list (newest first). */
export type ActividadData = InfiniteData<ActividadPage, ActividadCursor | null> & {
  items: ActividadItem[];
};

/**
 * Activity of an assignment, 50 entries per page with keyset pagination (created_at, id).
 *
 * - Key: `['cedularios','seguimiento','actividad',asignacionId]`. Stale after 30 s.
 * - Load more: `fetchNextPage()` when `hasNextPage`. `data.items` is the flat list.
 * - Disabled while `asignacionId` is empty or `enabled` is false (use `enabled` so the query
 *   only runs while the Actividad tab is open).
 */
export function useActividad(
  asignacionId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseInfiniteQueryResult<ActividadData, CedulariosQueryError> {
  return useInfiniteQuery<
    ActividadPage,
    CedulariosQueryError,
    ActividadData,
    ReturnType<typeof seguimientoKeys.actividad>,
    ActividadCursor | null
  >({
    queryKey: seguimientoKeys.actividad(asignacionId ?? ''),
    queryFn: ({ pageParam }) =>
      consultar(() => fetchActividad(createClient(), asignacionId as string, pageParam)),
    initialPageParam: null,
    getNextPageParam: (ultima) => ultima.nextCursor ?? undefined,
    select: (data) => ({ ...data, items: data.pages.flatMap((pagina) => pagina.items) }),
    enabled: Boolean(asignacionId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.actividad,
    retry: reintentarConsulta,
  });
}
