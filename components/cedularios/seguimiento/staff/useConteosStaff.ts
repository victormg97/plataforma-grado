'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import { fetchConteosStaff } from '@/lib/queries/cedularios/seguimiento/staff';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { useSegRol } from '../hooks/useSegRol';

/**
 * Active cedulario assignments per profesor/administrador (map id -> count), in ONE RPC.
 * Admin only; missing ids mean 0.
 */
export function useConteosStaff() {
  const { isAdmin } = useSegRol();
  return useQuery<Record<string, number>, CedulariosQueryError>({
    queryKey: seguimientoKeys.staffConteos(),
    queryFn: () => consultar(() => fetchConteosStaff(createClient())),
    enabled: isAdmin,
    staleTime: SEG_STALE_TIME.staffConteos,
    retry: reintentarConsulta,
  });
}
