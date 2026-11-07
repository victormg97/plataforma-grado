'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import {
  fetchMateriasInactivas,
  type MateriaInactivaProgreso,
} from '@/lib/queries/cedularios/seguimiento/actividad';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';

/**
 * Deactivated materias that still have progress in an assignment (staff only; the RPC
 * rejects other roles, so callers pass `enabled` false for students and readers).
 *
 * - Key: `['cedularios','seguimiento','inactivas',asignacionId]`. Stale after 30 s.
 * - Disabled while `asignacionId` is empty or `enabled` is false.
 */
export function useMateriasInactivas(
  asignacionId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<MateriaInactivaProgreso[], CedulariosQueryError> {
  return useQuery<MateriaInactivaProgreso[], CedulariosQueryError>({
    queryKey: seguimientoKeys.inactivas(asignacionId ?? ''),
    queryFn: () => consultar(() => fetchMateriasInactivas(createClient(), asignacionId as string)),
    enabled: Boolean(asignacionId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.inactivas,
    retry: reintentarConsulta,
  });
}
