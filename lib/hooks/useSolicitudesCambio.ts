'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SolicitudCambioEstado = 'pendiente' | 'aceptada' | 'rechazada';

export type SolicitudCambio = {
  id: string;
  alumno_id: string;
  profesor_id: string;
  horario_original_id: string;
  fecha_propuesta: string;
  hora_inicio_propuesta: string;
  hora_fin_propuesta: string;
  estado: SolicitudCambioEstado;
  motivo_rechazo: string | null;
  nuevo_horario_id: string | null;
  nota_alumno: string | null;
  created_at: string;
  updated_at: string;
  alumno?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
  profesor?: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
  horario_original?: {
    id: string;
    titulo: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
  } | null;
};

export type CreateSolicitudPayload = {
  horario_original_id: string;
  fecha_propuesta: string;
  hora_inicio_propuesta: string;
  hora_fin_propuesta: string;
  nota_alumno?: string;
};

export type RespondSolicitudPayload = {
  id: string;
  estado: 'aceptada' | 'rechazada';
  motivo_rechazo?: string;
};

export type UseSolicitudesCambioOptions = {
  estado?: SolicitudCambioEstado;
  horario_id?: string;
  limit?: number;
  enabled?: boolean;
};

// ─── Query Key ────────────────────────────────────────────────────────────────

const SOLICITUDES_KEY = 'solicitudes-cambio';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSolicitudesCambio(options?: UseSolicitudesCambioOptions) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();

  const { estado, horario_id, limit, enabled = true } = options ?? {};

  // Build query key including filters for proper cache separation
  const queryKey = [SOLICITUDES_KEY, user?.id, { estado, horario_id, limit }];

  // ─── Fetch solicitudes ────────────────────────────────────────────────────

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (estado) params.set('estado', estado);
      if (horario_id) params.set('horario_id', horario_id);
      if (limit) params.set('limit', String(limit));

      const url = `/api/solicitudes-cambio${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al cargar solicitudes');
      }

      return res.json() as Promise<SolicitudCambio[]>;
    },
    enabled: !!user?.id && enabled,
    staleTime: 30_000,
  });

  // ─── Create solicitud mutation ────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: CreateSolicitudPayload) => {
      const res = await fetch('/api/solicitudes-cambio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al crear solicitud');
      }

      return res.json() as Promise<SolicitudCambio>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SOLICITUDES_KEY] });
    },
  });

  // ─── Respond (accept/reject) mutation ─────────────────────────────────────

  const respondMutation = useMutation({
    mutationFn: async ({ id, estado: newEstado, motivo_rechazo }: RespondSolicitudPayload) => {
      const res = await fetch(`/api/solicitudes-cambio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newEstado, motivo_rechazo }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al responder solicitud');
      }

      return res.json() as Promise<SolicitudCambio>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SOLICITUDES_KEY] });
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia'] });
    },
  });

  // ─── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();

    // Subscribe to changes on solicitudes_cambio_horario for the current user.
    // For alumnos: listen for updates to their solicitudes (status changes).
    // For profesores: listen for new inserts directed to them.
    const filterColumn = user.rol === 'profesor' ? 'profesor_id' : 'alumno_id';

    const channel = supabase
      .channel(`solicitudes-cambio-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitudes_cambio_horario',
          filter: `${filterColumn}=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [SOLICITUDES_KEY] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.rol, queryClient]);

  // ─── Convenience callbacks ────────────────────────────────────────────────

  const crearSolicitud = useCallback(
    async (payload: CreateSolicitudPayload) => {
      return createMutation.mutateAsync(payload);
    },
    [createMutation]
  );

  const aceptarSolicitud = useCallback(
    async (id: string) => {
      return respondMutation.mutateAsync({ id, estado: 'aceptada' });
    },
    [respondMutation]
  );

  const rechazarSolicitud = useCallback(
    async (id: string, motivo_rechazo?: string) => {
      return respondMutation.mutateAsync({ id, estado: 'rechazada', motivo_rechazo });
    },
    [respondMutation]
  );

  return {
    solicitudes: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,

    // Mutations
    crearSolicitud,
    aceptarSolicitud,
    rechazarSolicitud,

    // Mutation states
    creating: createMutation.isPending,
    createError: createMutation.error?.message ?? null,
    responding: respondMutation.isPending,
    respondError: respondMutation.error?.message ?? null,
  };
}
