'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import type { ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import { fetchProgresoAsignacion } from '@/lib/queries/cedularios/seguimiento/progreso';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';

/**
 * Flat progress list of an assignment (one row per materia, with counts of repasos,
 * comentarios and clases). RLS decides what each role sees.
 *
 * - Key: `['cedularios','seguimiento','progreso',asignacionId]`. Stale after 30 s.
 * - Disabled while `asignacionId` is empty or `enabled` is false.
 */
export function useProgresoAsignacion(
  asignacionId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<ProgresoFila[], CedulariosQueryError> {
  return useQuery<ProgresoFila[], CedulariosQueryError>({
    queryKey: seguimientoKeys.progreso(asignacionId ?? ''),
    queryFn: () => consultar(() => fetchProgresoAsignacion(createClient(), asignacionId as string)),
    enabled: Boolean(asignacionId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.progreso,
    retry: reintentarConsulta,
  });
}
