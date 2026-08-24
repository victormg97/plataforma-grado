'use client';

/**
 * Slice `ocultacion` — hook de lectura de Actividades ocultas (Requisitos 9.11, 9.12).
 *
 * Usa `createClient()` del lado del cliente con RLS para consultar directamente
 * `agenda_evento_ocultaciones` con join a `agenda_eventos`. La RLS limita las
 * filas al propio alumno y excluye las Actividades que ya no recibe.
 *
 * Clave de React Query: `['agenda-ocultaciones', usuarioId, desde, hasta]`.
 * staleTime: 5 min (misma política que useEventosAgenda).
 */
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { leerActividadesOcultas, type ActividadOculta } from '../consulta';
import type { RangoVisible } from '@/lib/agenda/nucleo';

/** 5 minutos de staleTime. */
const STALE_TIME = 5 * 60 * 1000;

interface UseActividadesOcultasOpciones {
  /** ID del usuario autenticado (alumno). Si es undefined, la query se deshabilita. */
  usuarioId: string | undefined;
  /** Rango de fechas visible en el calendario. */
  rango: RangoVisible;
}

interface UseActividadesOcultasResultado {
  ocultas: ActividadOculta[];
  isLoading: boolean;
}

/**
 * Trae las Actividades ocultas por el alumno dentro del rango visible.
 *
 * La consulta se ejecuta directamente contra Supabase con RLS, siguiendo el patrón
 * de `leerActividadesOcultas` que acepta un cliente de navegador.
 */
export function useActividadesOcultas({
  usuarioId,
  rango,
}: UseActividadesOcultasOpciones): UseActividadesOcultasResultado {
  const { data, isLoading } = useQuery<ActividadOculta[]>({
    queryKey: ['agenda-ocultaciones', usuarioId, rango.desde, rango.hasta],
    queryFn: async () => {
      const supabase = createClient();
      return leerActividadesOcultas(supabase, rango);
    },
    enabled: !!usuarioId,
    staleTime: STALE_TIME,
  });

  return {
    ocultas: data ?? [],
    isLoading,
  };
}
