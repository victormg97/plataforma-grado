'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * Returns the current server time (UTC).
 * Refreshes every 60s. Use for comparing dates/times instead of new Date().
 */
export function useServerTime() {
  const { data: serverTime, isLoading } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_server_time');
      if (error) throw new Error(error.message);
      return data as string;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return { serverTime: serverTime ?? null, isLoading };
}

/**
 * Utility to get Chile timezone date/time components from a UTC ISO string.
 */
export function toChileDate(utcIso: string) {
  const d = new Date(utcIso);
  const chile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // "YYYY-MM-DD"
  return chile;
}

export function toChileTime(utcIso: string) {
  const d = new Date(utcIso);
  const chile = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d); // "HH:MM:SS"
  return chile;
}

/**
 * Hook to check if a class is currently in progress or has already passed.
 * Uses server time instead of client time.
 */
export function useClaseTimeStatus(fecha: string, horaInicio: string, horaFin: string) {
  const { serverTime, isLoading } = useServerTime();

  if (!serverTime || isLoading) {
    return { enCurso: false, yaPaso: false, esFuturo: true, isLoading: true };
  }

  const todayChile = toChileDate(serverTime);
  const nowChile = toChileTime(serverTime);

  const esFuturo = fecha > todayChile || (fecha === todayChile && horaInicio > nowChile);
  const enCurso = fecha === todayChile && horaInicio <= nowChile && horaFin >= nowChile;
  const yaPaso = fecha < todayChile || (fecha === todayChile && horaFin < nowChile);

  return { enCurso, yaPaso, esFuturo, isLoading: false };
}
