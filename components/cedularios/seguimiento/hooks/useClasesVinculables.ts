'use client';

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import {
  ASIGNABLES_PAGE_SIZE,
  fetchClasesVinculables,
  type ClaseVinculable,
} from '@/lib/queries/cedularios/seguimiento/asignables';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { useBusquedaSeg } from './useBusquedaSeg';

/** `data.pages` as returned by React Query, plus every loaded class in one list. */
export type ClasesVinculablesData = InfiniteData<ClaseVinculable[], number> & {
  items: ClaseVinculable[];
};

/**
 * Classes of the student of an assignment that can be linked to a materia, 50 per page
 * (offset pagination, newest date first). A full page means there may be more rows.
 *
 * - `q` is debounced (300 ms), trimmed and capped at 100 characters before it reaches the key:
 *   `['cedularios','seguimiento','vinculables',asignacionId,q]`. Stale after 30 s.
 * - While a new search loads, the list of the same assignment stays visible (`placeholderData`).
 * - Load more: `fetchNextPage()` when `hasNextPage`. `data.items` is the flat list.
 * - Disabled while `asignacionId` is empty or `enabled` is false (use `enabled` so the query
 *   only runs while the link dialog is open).
 */
export function useClasesVinculables(
  asignacionId: string | null | undefined,
  q: string | null | undefined = '',
  opciones: { enabled?: boolean } = {},
): UseInfiniteQueryResult<ClasesVinculablesData, CedulariosQueryError> {
  const busqueda = useBusquedaSeg(q);

  return useInfiniteQuery<
    ClaseVinculable[],
    CedulariosQueryError,
    ClasesVinculablesData,
    ReturnType<typeof seguimientoKeys.vinculables>,
    number
  >({
    queryKey: seguimientoKeys.vinculables(asignacionId ?? '', busqueda),
    queryFn: ({ pageParam }) =>
      consultar(() =>
        fetchClasesVinculables(createClient(), asignacionId as string, busqueda, pageParam),
      ),
    initialPageParam: 0,
    getNextPageParam: (ultima, paginas) =>
      ultima.length >= ASIGNABLES_PAGE_SIZE
        ? paginas.reduce((suma, pagina) => suma + pagina.length, 0)
        : undefined,
    select: (data) => ({ ...data, items: data.pages.flat() }),
    // Keep the previous list while a new search loads, but never another assignment's list.
    placeholderData: (previo, queryPrevia) =>
      queryPrevia?.queryKey[3] === (asignacionId ?? '') ? previo : undefined,
    enabled: Boolean(asignacionId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.vinculables,
    retry: reintentarConsulta,
  });
}
