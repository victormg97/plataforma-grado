'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import {
  fetchProgresoDetalle,
  type ProgresoDetalle,
} from '@/lib/queries/cedularios/seguimiento/progreso';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';

/**
 * Comments, repasos and linked classes of one progress row, loaded when the materia panel opens.
 *
 * - Key: `['cedularios','seguimiento','detalle',progresoId]`. Stale after 30 s.
 * - Disabled while `progresoId` is empty (materia without a progress row) or `enabled` is false.
 */
export function useProgresoDetalle(
  progresoId: string | null | undefined,
  opciones: { enabled?: boolean } = {},
): UseQueryResult<ProgresoDetalle, CedulariosQueryError> {
  return useQuery<ProgresoDetalle, CedulariosQueryError>({
    queryKey: seguimientoKeys.detalle(progresoId ?? ''),
    queryFn: () => consultar(() => fetchProgresoDetalle(createClient(), progresoId as string)),
    enabled: Boolean(progresoId) && (opciones.enabled ?? true),
    staleTime: SEG_STALE_TIME.detalle,
    retry: reintentarConsulta,
  });
}
