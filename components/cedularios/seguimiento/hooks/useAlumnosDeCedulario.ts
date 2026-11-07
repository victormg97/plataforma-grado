'use client';

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import {
  fetchAlumnosDeCedulario,
  type AlumnoDeCedulario,
  type PaginaAlumnosCedulario,
} from '@/lib/queries/cedularios/seguimiento/resumen';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { useBusquedaSeg } from './useBusquedaSeg';

/** `data.pages` as returned by React Query, plus every loaded student in one list and the total. */
export type AlumnosDeCedularioData = InfiniteData<PaginaAlumnosCedulario, number> & {
  filas: AlumnoDeCedulario[];
  /** Total rows matching the search, across all pages (0 when nothing matched). */
  total: number;
};

/**
 * Students with an active assignment to a cedulario, 50 per page (offset pagination).
 *
 * - `q` is debounced (300 ms), trimmed and capped at 100 characters before it reaches the key:
 *   `['cedularios','seguimiento','alumnos',cedularioId,q]`. Stale after 60 s.
 * - While a new search loads, the list of the same cedulario stays visible (`placeholderData`).
 * - Load more: `fetchNextPage()` when `hasNextPage`. `data.filas` is the flat list.
 * - Disabled while `cedularioId` is empty or `enabled` is false.
 */
export function useAlumnosDeCedulario(
  cedularioId: string | null | undefined,
  q: string | null | undefined = '',
  opciones: { enabled?: boolean } = {},
): UseInfiniteQueryResult<AlumnosDeCedularioData, CedulariosQueryError> {
  const busqueda = useBusquedaSeg(q);

  return useInfiniteQuery<
    PaginaAlumnosCedulario,
    CedulariosQueryError,
    AlumnosDeCedularioData,
    ReturnType<typeof seguimientoKeys.alumnos>,
    number
  >({
    queryKey: seguimientoKeys.alumnos(cedularioId ?? '', busqueda),
    queryFn: ({ pageParam }) =>
      consultar(() =>
        fetchAlumnosDeCedulario(createClient(), cedularioId as string, busqueda, pageParam),
      ),
    initialPageParam: 0,
    getNextPageParam: (ultima, paginas) => {
      const cargadas = paginas.reduce((suma, pagina) => suma + pagina.filas.length, 0);
      return ultima.filas.length > 0 && cargadas < ultima.total ? cargadas : undefined;
    },
    select: (data) => ({
      ...data,
      filas: data.pages.flatMap((pagina) => pagina.filas),
      total: data.pages[0]?.total ?? 0,
    }),
    // Keep the previous list while a new search loads, but never another cedulario's list.
    placeholderData: (previo, queryPrevia) =>
      queryPrevia?.queryKey[3] === (cedularioId ?? '') ? previo : undefined,
    enabled: Boolean(cedularioId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.alumnos,
    retry: reintentarConsulta,
  });
}
