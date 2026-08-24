'use client';

/**
 * Slice `nucleo` — hook de lectura de eventos + realtime (Requisitos 12.6, 12.11,
 * 17.1, 17.2, 17.3).
 *
 * - `queryFn` hace `fetch` a `GET /api/agenda/eventos` (ruta creada en la Fase 4,
 *   tarea 5.3). La proyección de visibilidad ocurre en el servidor, y el hook
 *   nunca recalcula campos ni aplica el payload de realtime directamente.
 * - El canal de realtime escucha `postgres_changes` en las tres tablas de agenda y
 *   solo invalida por prefijo (Requisito 12.6: reflejar el cambio en < 5 s).
 * - `staleTime: 5 min`, `gcTime: 60 min` — mismos valores que `useHorarios`.
 */
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

import { clavesAgenda } from '../claves';
import type { EventoAgendaProyectado, RangoVisible } from '../tipos';

let canalCounter = 0;

/** 5 minutos de staleTime, como useHorarios. */
const STALE_TIME = 5 * 60 * 1000;
/** 60 minutos de gcTime. */
const GC_TIME = 60 * 60 * 1000;

interface UseEventosAgendaOpciones {
  /** ID del usuario autenticado. Si es null/undefined, la query se deshabilita. */
  usuarioId: string | undefined;
  /** Rango de fechas visible en el calendario. */
  rango: RangoVisible;
}

interface UseEventosAgendaResultado {
  eventos: EventoAgendaProyectado[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Trae los eventos proyectados del rango visible y mantiene la caché sincronizada
 * via realtime.
 *
 * La ruta `GET /api/agenda/eventos?desde=...&hasta=...` se crea en la Fase 4
 * (tarea 5.3). El hook compila y funciona porque `fetch` es global; solo devuelve
 * un array vacío hasta que la ruta exista.
 */
export function useEventosAgenda({
  usuarioId,
  rango,
}: UseEventosAgendaOpciones): UseEventosAgendaResultado {
  const queryClient = useQueryClient();
  const nombreCanal = useRef(`agenda-eventos-ch-${++canalCounter}`);

  const { data, isLoading, error } = useQuery<EventoAgendaProyectado[]>({
    queryKey: clavesAgenda.eventos(usuarioId ?? '', rango),
    queryFn: async () => {
      const res = await fetch(
        `/api/agenda/eventos?desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`,
      );

      if (!res.ok) return [];

      const json = await res.json();
      return (json.data ?? json) as EventoAgendaProyectado[];
    },
    enabled: !!usuarioId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  // Realtime: invalida por prefijo al recibir cualquier evento de las tres tablas.
  useEffect(() => {
    if (!usuarioId) return;

    const supabase = createClient();
    const invalidar = () => {
      queryClient.invalidateQueries({
        queryKey: clavesAgenda.todosLosRangos(usuarioId),
      });
    };

    const canal = supabase
      .channel(nombreCanal.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_eventos' },
        invalidar,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_evento_destinatarios' },
        invalidar,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_evento_ocultaciones' },
        invalidar,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [usuarioId, queryClient]);

  return {
    eventos: data ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
