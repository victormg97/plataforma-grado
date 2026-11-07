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
  fetchAlumnosAsignables,
  type AlumnoAsignable,
} from '@/lib/queries/cedularios/seguimiento/asignables';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { useBusquedaSeg } from './useBusquedaSeg';

/** `data.pages` as returned by React Query, plus every loaded student in one list. */
export type AlumnosAsignablesData = InfiniteData<AlumnoAsignable[], number> & {
  items: AlumnoAsignable[];
};

/**
 * Active students the current user can assign a cedulario to, 50 per page (offset pagination).
 * A full page means there may be more rows.
 *
 * - `q` is debounced (300 ms), trimmed and capped at 100 characters before it reaches the key:
 *   `['cedularios','seguimiento','asignables',cedularioId,q]`. Stale after 30 s.
 * - While a new search loads, the list of the same cedulario stays visible (`placeholderData`).
 * - Load more: `fetchNextPage()` when `hasNextPage`. `data.items` is the flat list.
 * - Disabled while `cedularioId` is empty or `enabled` is false (use `enabled` so the query
 *   only runs while the assign dialog is open).
 */
export function useAlumnosAsignables(
  cedularioId: string | null | undefined,
  q: string | null | undefined = '',
  opciones: { enabled?: boolean } = {},
): UseInfiniteQueryResult<AlumnosAsignablesData, CedulariosQueryError> {
  const busqueda = useBusquedaSeg(q);

  return useInfiniteQuery<
    AlumnoAsignable[],
    CedulariosQueryError,
    AlumnosAsignablesData,
    ReturnType<typeof seguimientoKeys.asignables>,
    number
  >({
    queryKey: seguimientoKeys.asignables(cedularioId ?? '', busqueda),
    queryFn: ({ pageParam }) =>
      consultar(() =>
        fetchAlumnosAsignables(createClient(), {
          cedularioId: cedularioId as string,
          q: busqueda,
          offset: pageParam,
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (ultima, paginas) =>
      ultima.length >= ASIGNABLES_PAGE_SIZE
        ? paginas.reduce((suma, pagina) => suma + pagina.length, 0)
        : undefined,
    select: (data) => ({ ...data, items: data.pages.flat() }),
    // Keep the previous list while a new search loads, but never another cedulario's list.
    placeholderData: (previo, queryPrevia) =>
      queryPrevia?.queryKey[3] === (cedularioId ?? '') ? previo : undefined,
    enabled: Boolean(cedularioId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.asignables,
    retry: reintentarConsulta,
  });
}
