'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProgramaClase, ProgramaClaseConConteo } from '@/lib/supabase/types';

// ─── Queries ─────────────────────────────────────────────────────────────────

async function fetchProgramas(estado?: string): Promise<ProgramaClaseConConteo[]> {
  const url = `/api/programas${estado ? `?estado=${estado}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error cargando programas');
  return res.json();
}

async function fetchPrograma(id: string): Promise<ProgramaClase> {
  const res = await fetch(`/api/programas/${id}`);
  if (!res.ok) throw new Error('Programa no encontrado');
  return res.json();
}

export function useProgramas(estado?: string) {
  return useQuery({
    queryKey: ['programas', estado ?? 'activo'],
    queryFn: () => fetchProgramas(estado),
    staleTime: 30_000,
  });
}

export function usePrograma(id: string | null) {
  return useQuery({
    queryKey: ['programa', id],
    queryFn: () => fetchPrograma(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCrearPrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nombre: string; descripcion?: string | null; visibilidad?: string; profesor_ids?: string[] }) => {
      const res = await fetch('/api/programas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error creando programa');
      return res.json();
    },
    onSuccess: () => { return qc.invalidateQueries({ queryKey: ['programas'] }); },
  });
}

export function useEditarPrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nombre?: string; descripcion?: string | null; visibilidad?: string; profesor_ids?: string[] }) => {
      const res = await fetch(`/api/programas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error editando programa');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['programas'] }),
        qc.invalidateQueries({ queryKey: ['programa', vars.id] })
      ]);
    },
  });
}

export function useEliminarPrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/programas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error eliminando programa');
      return res.json();
    },
    onSuccess: () => { return qc.invalidateQueries({ queryKey: ['programas'] }); },
  });
}

export function useRestaurarPrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/programas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'activo' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error restaurando programa');
      return res.json();
    },
    onSuccess: (_data, id) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['programas'] }),
        qc.removeQueries({ queryKey: ['programa', id] }), // clear stale/error cache so it refetches fresh
      ]);
    },
  });
}

export function useEliminarProgramaDefinitivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/programas/${id}?definitivo=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error eliminando programa definitivamente');
      return res.json();
    },
    onSuccess: () => { return qc.invalidateQueries({ queryKey: ['programas'] }); },
  });
}


export function useActualizarClases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      programaId,
      clases,
    }: {
      programaId: string;
      clases: Array<{ id?: string; nombre: string; tipo: 'materia' | 'prueba'; orden: number; duracion_min?: number | null }>;
    }) => {
      const res = await fetch(`/api/programas/${programaId}/clases`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clases }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error actualizando clases');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      return qc.invalidateQueries({ queryKey: ['programa', vars.programaId] });
    },
  });
}

export function useAsignarPrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      programaId,
      alumno_ids,
      horarios_por_alumno,
    }: {
      programaId: string;
      alumno_ids: string[];
      horarios_por_alumno: Array<{
        alumno_id: string;
        clases: Array<{ clase_id: string; fecha: string; hora_inicio: string; hora_fin: string }>;
      }>;
    }) => {
      const res = await fetch(`/api/programas/${programaId}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumno_ids, horarios_por_alumno }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error asignando programa');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['programas'] }),
        qc.invalidateQueries({ queryKey: ['programa', vars.programaId] }),
        qc.invalidateQueries({ queryKey: ['horarios'] })
      ]);
    },
  });
}

export function useDesvincularAlumno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      programaId,
      alumnoId,
    }: {
      programaId: string;
      alumnoId: string;
    }) => {
      const res = await fetch(`/api/programas/${programaId}/asignaciones/${alumnoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error desvinculando alumno');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['programa', vars.programaId] }),
        qc.invalidateQueries({ queryKey: ['horarios'] }),
        qc.invalidateQueries({ queryKey: ['pruebas'] })
      ]);
    },
  });
}
