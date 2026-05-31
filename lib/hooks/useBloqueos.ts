'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type BloqueHorario = {
  id: string;
  profesor_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  /** Profesor/admin que creó el bloqueo (join con profiles) */
  profesor?: {
    id: string;
    nombre: string;
    apellido: string;
    apellido_materno: string | null;
    rol: string;
    avatar_url: string | null;
  } | null;
};

async function fetchBloqueos(profesorId?: string): Promise<BloqueHorario[]> {
  const url = profesorId
    ? `/api/bloqueos-horario?profesor_id=${profesorId}`
    : '/api/bloqueos-horario';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar bloqueos');
  return res.json();
}

/**
 * Fetches bloqueos_horario for a given professor (or all if admin and no profesorId).
 * Subscribes to realtime changes on the table.
 */
export function useBloqueos(profesorId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['bloqueos-horario', profesorId ?? 'all'];

  const { data: bloqueos = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchBloqueos(profesorId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bloqueos-${profesorId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueos_horario' }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesorId, queryClient]);

  const refetch = () => queryClient.invalidateQueries({ queryKey });

  return { bloqueos, isLoading, error: error?.message ?? null, refetch };
}
