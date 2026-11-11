'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { seguimientoKeys, SEG_STALE_TIME } from '@/lib/cedularios/seguimiento/keys';
import { fetchConteosAlumnos } from '@/lib/queries/cedularios/seguimiento/staff';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { useSegRol } from './useSegRol';

/**
 * Active cedulario assignments per alumno (map id -> count), in ONE RPC, for the Alumnos list.
 * Staff only; missing ids mean 0.
 */
export function useConteosAlumnos() {
  const { isStaff } = useSegRol();
  return useQuery<Record<string, number>, CedulariosQueryError>({
    queryKey: seguimientoKeys.alumnosConteos(),
    queryFn: () => consultar(() => fetchConteosAlumnos(createClient())),
    enabled: isStaff,
    staleTime: SEG_STALE_TIME.alumnosConteos,
    retry: reintentarConsulta,
  });
}
