'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Prueba } from '@/lib/supabase/types';

async function fetchPruebas(alumnoId?: string, estado?: string): Promise<Prueba[]> {
  const params = new URLSearchParams();
  if (alumnoId) params.set('alumno_id', alumnoId);
  if (estado) params.set('estado', estado);
  const qs = params.toString();
  const res = await fetch(`/api/pruebas${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Error cargando pruebas');
  return res.json();
}

export function usePruebas(alumnoId?: string, estado?: string) {
  return useQuery({
    queryKey: ['pruebas', alumnoId ?? 'all', estado ?? 'all'],
    queryFn: () => fetchPruebas(alumnoId, estado),
    staleTime: 30_000,
  });
}

export function usePrueba(id: string | null) {
  return useQuery({
    queryKey: ['prueba', id],
    queryFn: async () => {
      const res = await fetch(`/api/pruebas/${id}`);
      if (!res.ok) throw new Error('Prueba no encontrada');
      return res.json() as Promise<Prueba>;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCalificarPrueba() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      nota,
      observaciones,
    }: {
      id: string;
      nota?: number | null;
      observaciones?: string | null;
    }) => {
      const res = await fetch(`/api/pruebas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, observaciones }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error calificando prueba');
      return res.json() as Promise<Prueba>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pruebas'] });
      qc.invalidateQueries({ queryKey: ['prueba', data.id] });
    },
  });
}
