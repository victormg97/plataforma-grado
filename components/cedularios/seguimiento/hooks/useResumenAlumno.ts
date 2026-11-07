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
 * Cedulario summary of one student (header, record, selector and hover card).
 *
 * - Key: `['cedularios','seguimiento','resumen',alumnoId]`. Stale after 60 s.
 * - Resolves to `null` when the student is not visible or does not have the alumno role.
 * - `enabled` lets the hover card defer the request until it is opened. Disabled while
 *   `alumnoId` is empty.
 */
export function useResumenAlumno(
  alumnoId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<ResumenAlumno | null, CedulariosQueryError> {
  return useQuery<ResumenAlumno | null, CedulariosQueryError>({
    queryKey: seguimientoKeys.resumen(alumnoId ?? ''),
    queryFn: () => consultar(() => fetchResumenAlumno(createClient(), alumnoId as string)),
    enabled: Boolean(alumnoId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.resumen,
    retry: reintentarConsulta,
  });
}
