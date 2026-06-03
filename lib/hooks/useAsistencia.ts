'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
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
      /** Hours before class start after which attendance changes are blocked. 0 = block at class start. */
      cancellation_deadline_hours: number;
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

  const clases = useMemo(() => data?.clases ?? [], [data?.clases]);

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
  const now = new Date();

  const proximas = useMemo(
    () =>
      clases
        .filter((c) => {
          if (!c.horario || !c.horario.activo) return false;
          // Excluir clases cuya hora_fin ya pasó hoy
          const fin = new Date(`${c.horario.fecha}T${c.horario.hora_fin}`);
          return fin > now;
        })
        .sort((a, b) => a.horario.fecha.localeCompare(b.horario.fecha) || a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clases]
  );

  const historial = useMemo(
    () =>
      clases
        .filter((c) => {
          if (!c.horario) return false;
          const fin = new Date(`${c.horario.fecha}T${c.horario.hora_fin}`);
          return fin <= now;
        })
        .sort((a, b) => b.horario.fecha.localeCompare(a.horario.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clases]
  );

  // Prefer client-side proximas[0] so the datetime comparison above (hora_fin > now)
  // takes precedence over the DB's date-only proxima_clase fallback.
  const proximaClase = proximas[0] ?? data?.proxima_clase ?? null;

  // Auto-invalidate when the deadline of the próxima clase is reached.
  // This triggers a refetch so the UI reflects the auto-cancellation without
  // the user needing to reload the page.
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    if (!proximaClase || proximaClase.estado !== 'pendiente') return;

    const deadlineHours = proximaClase.horario.profesor?.cancellation_deadline_hours ?? 0;
    const classStart = new Date(`${proximaClase.horario.fecha}T${proximaClase.horario.hora_inicio}`);
    // When deadline=0, the cutoff is classStart; otherwise classStart - deadlineHours
    const cutoff = deadlineHours === 0
      ? classStart
      : new Date(classStart.getTime() - deadlineHours * 3600 * 1000);

    const msUntilCutoff = cutoff.getTime() - Date.now();
    if (msUntilCutoff <= 0) return; // already past — DB cron will handle it shortly

    deadlineTimerRef.current = setTimeout(() => {
      // Invalidate so the UI refetches updated estado from the DB
      queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
    }, msUntilCutoff + 2000); // +2s to give the cron a moment to run

    return () => {
      if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    };
  }, [proximaClase, id, queryClient]);

  const confirmar = useCallback(async (asistenciaId: string) => {
    const res = await fetch(`/api/asistencia/${asistenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'confirmado' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error || 'Error al confirmar';
      // Invalidate on 403 to refresh UI state (class may have ended while page was open)
      if (res.status === 403) {
        queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
      }
      throw new Error(message);
    }
    queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
  }, [id, queryClient]);

  const cancelar = useCallback(async (asistenciaId: string, nota?: string) => {
    const res = await fetch(`/api/asistencia/${asistenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado', nota_alumno: nota ?? null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error || 'Error al cancelar';
      if (res.status === 403) {
        queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
      }
      throw new Error(message);
    }
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
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error || 'Error al solicitar cambio';
      if (res.status === 403) {
        queryClient.invalidateQueries({ queryKey: ['asistencia', id] });
      }
      throw new Error(message);
    }
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
