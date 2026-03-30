'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { EstadoAsistencia } from '@/lib/supabase/types';
import { useUserStore } from '@/stores/useUserStore';

export type ClaseAlumno = {
  id: string; // asistencia id
  estado: EstadoAsistencia;
  nota_alumno: string | null;
  nuevo_horario_id: string | null;
  horario: {
    id: string;
    titulo: string;
    descripcion: string | null;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    activo: boolean;
    profesor: {
      id: string;
      nombre: string;
      apellido: string;
      avatar_url: string | null;
    } | null;
  };
};

async function fetchAlumnoDashboard(alumnoId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_alumno_dashboard', { p_alumno_id: alumnoId });
  if (error) throw new Error(error.message);
  return data as {
    clases: ClaseAlumno[];
    proxima_clase: ClaseAlumno | null;
    stats: { total: number; confirmadas: number; pendientes: number; canceladas: number };
  };
}

export function useAsistencia(alumnoId?: string) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const id = alumnoId ?? user?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['asistencia', id],
    queryFn: () => fetchAlumnoDashboard(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const clases = data?.clases ?? [];

  // Realtime: invalidate on changes
  useEffect(() => {
    if (!id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`alumno-asistencia-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistencia', filter: `alumno_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['asistencia', id] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'horarios', filter: `alumno_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['asistencia', id] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const today = new Date().toISOString().split('T')[0];

  const proximas = useMemo(
    () =>
      clases
        .filter((c) => c.horario && c.horario.fecha >= today && c.horario.activo)
        .sort((a, b) => a.horario.fecha.localeCompare(b.horario.fecha) || a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)),
    [clases, today]
  );

  const historial = useMemo(
    () =>
      clases
        .filter((c) => c.horario && c.horario.fecha < today)
        .sort((a, b) => b.horario.fecha.localeCompare(a.horario.fecha)),
    [clases, today]
  );

  const proximaClase = data?.proxima_clase ?? proximas[0] ?? null;

  const confirmar = useCallback(async (asistenciaId: string) => {
    const res = await fetch(`/api/asistencia/${asistenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'confirmado' }),
    });
    if (!res.ok) throw new Error('Error al confirmar');
    queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
  }, [id, queryClient]);

  const cancelar = useCallback(async (asistenciaId: string, nota?: string) => {
    const res = await fetch(`/api/asistencia/${asistenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado', nota_alumno: nota ?? null }),
    });
    if (!res.ok) throw new Error('Error al cancelar');
    queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
  }, [id, queryClient]);

  const pedirCambio = useCallback(async (asistenciaId: string, nuevoHorarioId: string, nota?: string) => {
    const res = await fetch(`/api/asistencia/${asistenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'cambiado',
        nuevo_horario_id: nuevoHorarioId,
        nota_alumno: nota ?? null,
      }),
    });
    if (!res.ok) throw new Error('Error al solicitar cambio');
    queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
  }, [id, queryClient]);

  return {
    clases,
    proximas,
    historial,
    proximaClase,
    stats: data?.stats ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
    confirmar,
    cancelar,
    pedirCambio,
  };
}
