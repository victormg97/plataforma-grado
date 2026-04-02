'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { NotaClaseConAutor } from '@/lib/supabase/types';

async function fetchNotasClase(horarioId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_notas_clase', { p_horario_id: horarioId });
  if (error) throw new Error(error.message);
  return (data ?? []) as NotaClaseConAutor[];
}

export function useNotasClase(horarioId: string | null) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const queryKey = ['notas-clase', horarioId];

  const { data: notas = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchNotasClase(horarioId!),
    enabled: !!horarioId,
    staleTime: 30_000,
  });

  // Realtime: invalidate on changes to notas_clase for this horario
  useEffect(() => {
    if (!horarioId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notas-clase-${horarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notas_clase', filter: `horario_id=eq.${horarioId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notas-clase', horarioId] });
          queryClient.invalidateQueries({ queryKey: ['notas-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [horarioId, queryClient]);

  // Local filtering (no extra DB calls)
  const filteredNotas = useMemo(() => {
    if (!searchTerm.trim()) return notas;
    const lower = searchTerm.toLowerCase();
    return notas.filter(
      (n) =>
        n.contenido.toLowerCase().includes(lower) ||
        n.autor.nombre.toLowerCase().includes(lower) ||
        n.autor.apellido.toLowerCase().includes(lower)
    );
  }, [notas, searchTerm]);

  // Create
  const createMutation = useMutation({
    mutationFn: async (contenido: string) => {
      const res = await fetch('/api/notas-clase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario_id: horarioId, contenido }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al crear nota');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['notas-count'] });
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, contenido }: { id: string; contenido: string }) => {
      const res = await fetch(`/api/notas-clase/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al actualizar nota');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notas-clase/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Error al eliminar nota');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['notas-count'] });
    },
  });

  return {
    notas: filteredNotas,
    allNotas: notas,
    loading: isLoading,
    error: error?.message ?? null,
    searchTerm,
    setSearchTerm,
    crear: createMutation.mutateAsync,
    actualizar: updateMutation.mutateAsync,
    eliminar: deleteMutation.mutateAsync,
    creando: createMutation.isPending,
    actualizando: updateMutation.isPending,
    eliminando: deleteMutation.isPending,
  };
}
