'use client';

import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { cedulariosKeys, STALE_TIME } from '@/lib/cedularios/keys';
import {
  fetchHistorial,
  type HistorialCursor,
  type HistorialFiltros,
  type HistorialItem,
  type HistorialPage,
} from '@/lib/queries/cedularios/historial';
import { CedulariosQueryError, consultar, reintentarConsulta } from './cedulariosQuery';

/** `data.pages` as returned by React Query, plus every loaded item in one list (newest first). */
export type HistorialData = InfiniteData<HistorialPage, HistorialCursor | null> & {
  items: HistorialItem[];
};

/**
 * Change history of a cedulario, 50 entries per page with keyset pagination.
 *
 * - Key: `['cedularios','historial',cedularioId,filtros]`. Changing the filters starts a new
 *   query; the previous list stays visible meanwhile (`placeholderData`), so an invalid filter
 *   that the caller does not apply never blanks the list.
 * - Stale after 30 s. The Realtime hook does not invalidate it: it loads on open and on an
 *   explicit `refetch()`.
 * - Load more: `fetchNextPage()` when `hasNextPage`. `data.items` is the flat list of all
 *   loaded pages.
 * - Disabled while `cedularioId` is empty or `enabled` is false (use `enabled` so the query
 *   only runs while the Historial tab is open).
 */
export function useHistorial(
  cedularioId: string | null | undefined,
  filtros: HistorialFiltros = {},
  opciones: { enabled?: boolean } = {},
): UseInfiniteQueryResult<HistorialData, CedulariosQueryError> {
  return useInfiniteQuery<
    HistorialPage,
    CedulariosQueryError,
    HistorialData,
    ReturnType<typeof cedulariosKeys.historial>,
    HistorialCursor | null
  >({
    queryKey: cedulariosKeys.historial(cedularioId ?? '', { ...filtros }),
    queryFn: ({ pageParam }) =>
      consultar(() => fetchHistorial(createClient(), cedularioId as string, filtros, pageParam)),
    initialPageParam: null,
    getNextPageParam: (ultima) => ultima.nextCursor ?? undefined,
    select: (data) => ({ ...data, items: data.pages.flatMap((pagina) => pagina.items) }),
    // Keep the previous list while new filters load, but never another cedulario's list.
    placeholderData: (previo, queryPrevia) =>
      queryPrevia?.queryKey[2] === (cedularioId ?? '') ? previo : undefined,
    enabled: Boolean(cedularioId) && (opciones.enabled ?? true),
    staleTime: STALE_TIME.historial,
    retry: reintentarConsulta,
  });
}
