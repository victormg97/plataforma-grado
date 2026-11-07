'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import { fetchResumenAlumno, type ResumenAlumno } from '@/lib/queries/cedularios/seguimiento/resumen';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';

/**
 * Cedulario summary of one student for the record section: active AND unassigned
 * assignments (the unassigned ones feed the "Reasignar" history).
 *
 * The key lives under the summary prefix, so every summary invalidation reaches it. It is the
 * same key and fetcher as the assign dialog uses to look up the assignment to reassign, so both
 * share one cache entry. `useResumenAlumno` is not reused because it excludes unassigned rows.
 */
export function useResumenFicha(
  alumnoId: string | null | undefined,
): UseQueryResult<ResumenAlumno | null, CedulariosQueryError> {
  return useQuery<ResumenAlumno | null, CedulariosQueryError>({
    queryKey: [...seguimientoKeys.resumen(alumnoId ?? ''), 'con_desasignadas'] as const,
    queryFn: () => consultar(() => fetchResumenAlumno(createClient(), alumnoId as string, true)),
    enabled: Boolean(alumnoId),
    staleTime: SEG_STALE_TIME.resumen,
    retry: reintentarConsulta,
  });
}
