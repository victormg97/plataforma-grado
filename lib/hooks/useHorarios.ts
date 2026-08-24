'use client';

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useHorarioStore } from '@/stores/useHorarioStore';
import { useUserStore } from '@/stores/useUserStore';
import type { EstadoAsistencia, TipoClase } from '@/lib/supabase/types';

let channelCounter = 0;

export type HorarioConAsistencia = {
  id: string;
  profesor_id: string;
  alumno_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  es_recurrente: boolean;
  from_programa: boolean | null;
  activo: boolean;
  /** Absent in the professor dashboard RPC payload; present when selecting the row directly. */
  enlace_conexion?: string | null;
  tipo_clase?: TipoClase;
  created_at: string;
  updated_at: string;
  asistencia: {
    id: string;
    estado: EstadoAsistencia;
    nota_alumno: string | null;
  }[];
  alumno: {
    id: string;
    nombre: string;
    apellido: string;
    apellido_materno: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  notas_count?: number;
  /** Populated only when fetching a single horario via GET /api/horarios/:id */
  pruebas?: { id: string; nombre: string; estado: string }[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    horario: HorarioConAsistencia;
    estado: EstadoAsistencia;
  };
};

const estadoColors: Record<EstadoAsistencia, { bg: string; border: string; text: string }> = {
  pendiente: { bg: 'var(--color-brand-gold)', border: 'var(--color-brand-gold)', text: 'var(--color-brand-black)' },
  confirmado: { bg: 'var(--color-success)', border: 'var(--color-success)', text: 'var(--color-brand-white)' },
  cancelado: { bg: 'var(--color-error)', border: 'var(--color-error)', text: 'var(--color-brand-white)' },
  cambiado: { bg: 'var(--color-info)', border: 'var(--color-info)', text: 'var(--color-brand-white)' },
  no_asistio: { bg: '#6b7280', border: '#6b7280', text: 'var(--color-brand-white)' },
};

async function fetchProfesorDashboard(profesorId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_profesor_dashboard', { p_profesor_id: profesorId });
  if (error) throw new Error(error.message);
  return data as {
    horarios: HorarioConAsistencia[];
    stats: { total: number; pendientes: number; confirmadas: number; canceladas: number };
    alumnos: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null }[];
  };
}

async function fetchHorariosFallback(targetId: string, rol: string) {
  const supabase = createClient();
  let query = supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*)')
    .eq('activo', true);

  if (rol === 'profesor') {
    query = query.eq('profesor_id', targetId);
  } else if (rol === 'alumno') {
    query = query.eq('alumno_id', targetId);
  }

  const { data, error } = await query.order('fecha', { ascending: true });
  if (error) throw new Error(error.message);
  return data as unknown as HorarioConAsistencia[];
}

export function useHorarios(profesorId?: string) {
  const { setHorarios } = useHorarioStore();
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const channelName = useRef(`horarios-ch-${++channelCounter}`);

  const targetId = profesorId || user?.id;
  const isProfesor = user?.rol === 'profesor' || !!profesorId;

  // Main query: use SP for professors, fallback query for alumnos/others
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['horarios', targetId],
    queryFn: async () => {
      if (!targetId) return null;
      if (isProfesor) {
        return fetchProfesorDashboard(targetId);
      }
      const horarios = await fetchHorariosFallback(targetId, user?.rol || '');
      return { horarios, stats: null, alumnos: null };
    },
    enabled: !!targetId,
    // 5 minutes until data becomes "stale" (requires background refetch).
    // The realtime webhooks already force refetches on DB changes.
    staleTime: 1000 * 60 * 5,
    // 1 Hour in RAM memory. Fixes "loading spinners" when returning to page
    gcTime: 1000 * 60 * 60,
  });

  const rawData: HorarioConAsistencia[] = useMemo(() => data?.horarios ?? [], [data]);

  // Keep Zustand store in sync (for any legacy consumers)
  useEffect(() => {
    setHorarios(
      rawData.map((h) => ({ ...h, enlace_conexion: h.enlace_conexion ?? null, tipo_clase: h.tipo_clase ?? 'normal' })),
    );
  }, [rawData, setHorarios]);

  // Realtime: invalidate React Query cache on changes
  useEffect(() => {
    if (!targetId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => {
        queryClient.invalidateQueries({ queryKey: ['horarios', targetId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => {
        queryClient.invalidateQueries({ queryKey: ['horarios', targetId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetId, queryClient]);

  // Transform to FullCalendar events
  const events: CalendarEvent[] = useMemo(
    () =>
      rawData.map((h) => {
        const estado = h.asistencia?.[0]?.estado || 'pendiente';
        const colors = estadoColors[estado];
        return {
          id: h.id,
          title: `${h.titulo} - ${h.alumno?.nombre || 'Sin alumno'}`,
          start: `${h.fecha}T${h.hora_inicio}`,
          end: `${h.fecha}T${h.hora_fin}`,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { horario: h, estado },
        };
      }),
    [rawData]
  );

  // Stats: from SP if available, otherwise compute client-side
  const stats = useMemo(() => {
    if (data?.stats) return data.stats;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekHorarios = rawData.filter((h) => {
      const d = new Date(h.fecha);
      return d >= startOfWeek && d <= endOfWeek;
    });

    return {
      total: weekHorarios.length,
      confirmadas: weekHorarios.filter((h) => h.asistencia?.[0]?.estado === 'confirmado').length,
      pendientes: weekHorarios.filter((h) => h.asistencia?.[0]?.estado === 'pendiente').length,
      canceladas: weekHorarios.filter((h) => h.asistencia?.[0]?.estado === 'cancelado').length,
    };
  }, [data?.stats, rawData]);

  // Alumnos from SP (for HorarioForm dropdown)
  const alumnos = data?.alumnos ?? [];

  const refetchHorarios = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    horarios: rawData,
    rawData,
    events,
    stats,
    alumnos,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: refetchHorarios,
  };
}
