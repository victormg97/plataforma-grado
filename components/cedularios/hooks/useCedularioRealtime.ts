'use client';

/**
 * Realtime invalidation channel for one open cedulario (Req 16.4, 18.1-18.4, 18.8, 18.9).
 *
 * - One channel `cedulario:<id>` with `postgres_changes` subscriptions (see the table in the
 *   design, "Realtime and presence"). It never subscribes to `universidades` or `historial_cambios`.
 * - Payloads are signals only. They are never written to the React Query cache; the affected
 *   queries are invalidated and refetched from the database.
 * - Invalidations are debounced: they run 300 ms after the last signal, so a burst of events
 *   produces a single refetch.
 * - Events caused by the current user (`new.updated_by` equals the user id) are ignored.
 * - DELETE events cannot be filtered by the server, so they invalidate only when `old.id` is in
 *   the cached list of the matching key.
 * - After a reconnect (SUBSCRIBED after CLOSED / CHANNEL_ERROR / TIMED_OUT) every key of the
 *   cedulario is invalidated, so missed events cannot leave stale data.
 * - Presence lives in `useCedularioPresence` (separate channel).
 */

import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { cedulariosKeys } from '@/lib/cedularios/keys';

/** Debounce window between the last signal and the refetch (Req 16.4, 18.9). */
export const REALTIME_DEBOUNCE_MS = 300;

export type CedularioRealtimeTabla = 'cedularios' | 'materias';

/**
 * Another user changed content of a record that an editor may be showing.
 * `campo` is set when the old/new comparison proved that the field changed. When it is
 * undefined the payload could not tell (default replica identity only carries the new row,
 * and large values can be omitted), so the editor should compare `updated_at` of the
 * refetched record with the one it loaded.
 */
export interface CedularioRemoteChange {
  tabla: CedularioRealtimeTabla;
  campo?: 'normativa' | 'rubrica' | 'temario';
  registroId: string;
  /** `updated_at` of the new row when the payload carried it (signal only, not display data). */
  updatedAt?: string;
}

export interface UseCedularioRealtimeOptions {
  /**
   * Called (after the debounce, when the invalidation is issued) for each content change made by
   * another user: cedularios UPDATE (normativa / rubrica) and materias UPDATE (temario).
   * Stored in a ref, so changing the function does not reopen the channel.
   */
  onRemoteChange?: (change: CedularioRemoteChange) => void;
}

type Fila = Record<string, unknown>;
type Payload = RealtimePostgresChangesPayload<Fila>;

/** Prefixes that are not covered by a single-id key of the factory. */
const PREFIJO_ENLACES_MATERIA = [...cedulariosKeys.all, 'enlaces', 'materia'] as const;
const PREFIJO_ENLACES = [...cedulariosKeys.all, 'enlaces'] as const;
const PREFIJO_MATERIA = [...cedulariosKeys.all, 'materia'] as const;

const CAMPOS_CEDULARIO = ['normativa', 'rubrica'] as const;
const CAMPOS_MATERIA = ['temario'] as const;

function leerString(fila: Fila | undefined, campo: string): string | undefined {
  const valor = fila?.[campo];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

function filaVacia(fila: Fila | undefined): boolean {
  return !fila || Object.keys(fila).length === 0;
}

/** True when `datos` (any cached shape: array, `{ items }`, infinite pages...) holds a record with `id`. */
function contieneId(datos: unknown, id: string, profundidad = 0): boolean {
  if (profundidad > 4 || datos === null || typeof datos !== 'object') return false;
  if (Array.isArray(datos)) return datos.some((el) => contieneId(el, id, profundidad + 1));
  const objeto = datos as Record<string, unknown>;
  if (objeto.id === id) return true;
  return Object.values(objeto).some((v) => contieneId(v, id, profundidad + 1));
}

/** Keys (under `prefijo`) whose cached data contains a record with `id`. */
function clavesConId(queryClient: QueryClient, prefijo: QueryKey, id: string): QueryKey[] {
  return queryClient
    .getQueriesData({ queryKey: prefijo })
    .filter(([, datos]) => contieneId(datos, id))
    .map(([clave]) => clave);
}

export function useCedularioRealtime(
  cedularioId: string | null | undefined,
  options: UseCedularioRealtimeOptions = {},
): void {
  const queryClient = useQueryClient();
  const userId = useUserStore((s) => s.user?.id ?? null);

  const userIdRef = useRef<string | null>(userId);
  const onRemoteChangeRef = useRef(options.onRemoteChange);
  useEffect(() => {
    userIdRef.current = userId;
    onRemoteChangeRef.current = options.onRemoteChange;
  });

  useEffect(() => {
    if (!cedularioId) return;

    const supabase = createClient();
    const claves = new Map<string, QueryKey>();
    const cambios = new Map<string, CedularioRemoteChange>();
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let cerrado = false;
    let conProblemas = false;

    const vaciar = () => {
      temporizador = null;
      if (cerrado) return;
      const pendientes = [...claves.values()];
      const remotos = [...cambios.values()];
      claves.clear();
      cambios.clear();
      for (const queryKey of pendientes) {
        void queryClient.invalidateQueries({ queryKey });
      }
      for (const cambio of remotos) onRemoteChangeRef.current?.(cambio);
    };

    const programar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(vaciar, REALTIME_DEBOUNCE_MS);
    };

    const invalidar = (...lista: QueryKey[]) => {
      for (const clave of lista) claves.set(JSON.stringify(clave), clave);
      programar();
    };

    const registrarCambio = (cambio: CedularioRemoteChange) => {
      cambios.set(`${cambio.tabla}|${cambio.campo ?? ''}|${cambio.registroId}`, cambio);
      programar();
    };

    const esEcoPropio = (payload: Payload): boolean => {
      const yo = userIdRef.current;
      if (!yo) return false;
      const nueva = payload.new as Fila | undefined;
      const autor = leerString(nueva, 'updated_by') ?? leerString(nueva, 'granted_by');
      return autor === yo;
    };

    /**
     * Emits remote-change signals for the content fields. Compares old/new only when both rows
     * carry the field; otherwise emits one signal without `campo` for the editor to resolve.
     */
    const emitirContenido = (
      payload: Payload,
      tabla: CedularioRealtimeTabla,
      campos: readonly ('normativa' | 'rubrica' | 'temario')[],
    ) => {
      const nueva = payload.new as Fila;
      const vieja = payload.old as Fila | undefined;
      const registroId = leerString(nueva, 'id');
      if (!registroId) return;
      const updatedAt = leerString(nueva, 'updated_at');
      let desconocido = false;
      for (const campo of campos) {
        if (!filaVacia(vieja) && campo in nueva && vieja && campo in vieja) {
          if (JSON.stringify(nueva[campo]) !== JSON.stringify(vieja[campo])) {
            registrarCambio({ tabla, campo, registroId, updatedAt });
          }
        } else {
          desconocido = true;
        }
      }
      if (desconocido) registrarCambio({ tabla, registroId, updatedAt });
    };

    const alCedulario = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      invalidar(cedulariosKeys.detalle(cedularioId), cedulariosKeys.lista());
      emitirContenido(payload, 'cedularios', CAMPOS_CEDULARIO);
    };

    const alMateria = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      const materiaId = leerString(payload.new as Fila, 'id');
      invalidar(cedulariosKeys.materias(cedularioId));
      if (materiaId) invalidar(cedulariosKeys.materia(materiaId));
      if (payload.eventType === 'UPDATE') emitirContenido(payload, 'materias', CAMPOS_MATERIA);
    };

    const alEnlaceCedulario = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      invalidar(cedulariosKeys.enlaces('cedulario', cedularioId));
    };

    const alEnlaceMateria = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      const materiaId = leerString(payload.new as Fila, 'materia_id');
      invalidar(
        materiaId ? cedulariosKeys.enlaces('materia', materiaId) : PREFIJO_ENLACES_MATERIA,
      );
    };

    const alPermiso = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      invalidar(cedulariosKeys.permisos(cedularioId));
    };

    const idEliminado = (payload: Payload): string | undefined =>
      leerString(payload.old as Fila | undefined, 'id');

    const alEliminarEnlaceCedulario = (payload: Payload) => {
      const id = idEliminado(payload);
      if (!id) return;
      const coincidencias = clavesConId(queryClient, cedulariosKeys.enlaces('cedulario', cedularioId), id);
      if (coincidencias.length > 0) invalidar(...coincidencias);
    };

    const alEliminarEnlaceMateria = (payload: Payload) => {
      const id = idEliminado(payload);
      if (!id) return;
      const coincidencias = clavesConId(queryClient, PREFIJO_ENLACES_MATERIA, id);
      if (coincidencias.length > 0) invalidar(...coincidencias);
    };

    const alEliminarPermiso = (payload: Payload) => {
      const id = idEliminado(payload);
      if (!id) return;
      const coincidencias = clavesConId(queryClient, cedulariosKeys.permisos(cedularioId), id);
      if (coincidencias.length > 0) invalidar(...coincidencias);
    };

    const filtroCedulario = `cedulario_id=eq.${cedularioId}`;
    const esquema = 'public';

    const canal = supabase
      .channel(`cedulario:${cedularioId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'cedularios', filter: `id=eq.${cedularioId}` },
        alCedulario,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'materias', filter: filtroCedulario },
        alMateria,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'materias', filter: filtroCedulario },
        alMateria,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'cedulario_enlaces', filter: filtroCedulario },
        alEnlaceCedulario,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'cedulario_enlaces', filter: filtroCedulario },
        alEnlaceCedulario,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'materia_enlaces', filter: filtroCedulario },
        alEnlaceMateria,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'materia_enlaces', filter: filtroCedulario },
        alEnlaceMateria,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'cedulario_profesores', filter: filtroCedulario },
        alPermiso,
      )
      // DELETE events cannot be filtered by the server: match old.id against the cached lists.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: esquema, table: 'cedulario_enlaces' },
        alEliminarEnlaceCedulario,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: esquema, table: 'materia_enlaces' },
        alEliminarEnlaceMateria,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: esquema, table: 'cedulario_profesores' },
        alEliminarPermiso,
      )
      .subscribe((estado) => {
        if (cerrado) return;
        if (estado === 'SUBSCRIBED') {
          if (conProblemas) {
            conProblemas = false;
            // Missed events cannot be replayed: refresh everything of this cedulario.
            invalidar(
              cedulariosKeys.detalle(cedularioId),
              cedulariosKeys.lista(),
              cedulariosKeys.materias(cedularioId),
              PREFIJO_MATERIA,
              PREFIJO_ENLACES,
              cedulariosKeys.permisos(cedularioId),
            );
          }
        } else if (estado === 'CLOSED' || estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          conProblemas = true;
        }
      });

    return () => {
      cerrado = true;
      if (temporizador) clearTimeout(temporizador);
      claves.clear();
      cambios.clear();
      void supabase.removeChannel(canal);
    };
  }, [cedularioId, queryClient]);
}
