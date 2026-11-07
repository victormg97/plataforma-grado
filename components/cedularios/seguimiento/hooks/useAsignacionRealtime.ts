'use client';

/**
 * Realtime invalidation channel for one open assignment (Req 25.1-25.4, 25.8).
 *
 * - One channel `seguimiento:<asignacionId>` with `postgres_changes` subscriptions (see the
 *   table in the design, "Realtime"). It lives while the Revisor is open, also for the student
 *   in read-only mode, and is removed on cleanup.
 * - Payloads are signals only. They are never written to the React Query cache; the affected
 *   queries are invalidated and refetched from the database.
 * - Invalidations are debounced: they run 300 ms after the last signal, so a burst of events
 *   produces a single refetch.
 * - Events caused by the current user are ignored: `updated_by` on UPDATE and
 *   `created_by` (or `updated_by`) on INSERT.
 * - DELETE events cannot be filtered by the server and only carry `id` (no REPLICA IDENTITY FULL),
 *   so they conservatively invalidate the progress and the cached details of the assignment.
 * - After a reconnect (SUBSCRIBED after CLOSED / CHANNEL_ERROR / TIMED_OUT) every key of the
 *   assignment is invalidated, so missed events cannot leave stale data.
 * - When the assignment row arrives with `estado = 'desasignada'`, `onDesasignada` is called so
 *   the Revisor can switch to read-only (staff) or close (student).
 */

import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import type { ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import { REALTIME_DEBOUNCE_MS } from '@/components/cedularios/hooks/useCedularioRealtime';

export interface UseAsignacionRealtimeOptions {
  /**
   * Called (after the debounce, when the invalidation is issued) once the assignment row is
   * seen with `estado = 'desasignada'`. Stored in a ref, so changing the function does not
   * reopen the channel.
   */
  onDesasignada?: () => void;
}

type Fila = Record<string, unknown>;
type Payload = RealtimePostgresChangesPayload<Fila>;

/** Child tables that carry the derived `asignacion_id` column (Req 14.6). */
const TABLAS_HIJAS = [
  'materia_progreso_repasos',
  'materia_progreso_comentarios',
  'materia_progreso_clases',
] as const;

function leerString(fila: Fila | undefined, campo: string): string | undefined {
  const valor = fila?.[campo];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

export function useAsignacionRealtime(
  asignacionId: string | null | undefined,
  options: UseAsignacionRealtimeOptions = {},
): void {
  const queryClient = useQueryClient();
  const userId = useUserStore((s) => s.user?.id ?? null);

  const userIdRef = useRef<string | null>(userId);
  const onDesasignadaRef = useRef(options.onDesasignada);
  useEffect(() => {
    userIdRef.current = userId;
    onDesasignadaRef.current = options.onDesasignada;
  });

  useEffect(() => {
    if (!asignacionId) return;

    const supabase = createClient();
    const claves = new Map<string, QueryKey>();
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let cerrado = false;
    let conProblemas = false;
    let desasignadaPendiente = false;

    const vaciar = () => {
      temporizador = null;
      if (cerrado) return;
      const pendientes = [...claves.values()];
      const avisar = desasignadaPendiente;
      claves.clear();
      desasignadaPendiente = false;
      for (const queryKey of pendientes) {
        void queryClient.invalidateQueries({ queryKey });
      }
      if (avisar) onDesasignadaRef.current?.();
    };

    const programar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(vaciar, REALTIME_DEBOUNCE_MS);
    };

    const invalidar = (...lista: QueryKey[]) => {
      for (const clave of lista) claves.set(JSON.stringify(clave), clave);
      programar();
    };

    /** Detail keys of every progress row of the assignment that is in the cache. */
    const detallesEnCache = (): QueryKey[] => {
      const filas = queryClient.getQueryData<ProgresoFila[]>(seguimientoKeys.progreso(asignacionId));
      return (filas ?? []).map((fila) => seguimientoKeys.detalle(fila.id));
    };

    const esEcoPropio = (payload: Payload): boolean => {
      const yo = userIdRef.current;
      if (!yo) return false;
      const nueva = payload.new as Fila | undefined;
      const autor =
        payload.eventType === 'INSERT'
          ? (leerString(nueva, 'created_by') ?? leerString(nueva, 'updated_by'))
          : leerString(nueva, 'updated_by');
      return autor === yo;
    };

    const alProgreso = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      const progresoId = leerString(payload.new as Fila, 'id');
      invalidar(seguimientoKeys.progreso(asignacionId), seguimientoKeys.resumenes());
      if (progresoId) invalidar(seguimientoKeys.detalle(progresoId));
    };

    const alHijo = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      const progresoId = leerString(payload.new as Fila, 'progreso_id');
      invalidar(seguimientoKeys.progreso(asignacionId));
      if (progresoId) invalidar(seguimientoKeys.detalle(progresoId));
    };

    // DELETE carries only `id` and cannot be filtered: refresh the progress and cached details.
    const alEliminar = () => {
      invalidar(seguimientoKeys.progreso(asignacionId), ...detallesEnCache());
    };

    const alAsignacion = (payload: Payload) => {
      const nueva = payload.new as Fila;
      // The state change is reported even for own writes: it is idempotent for the Revisor.
      if (nueva.estado === 'desasignada') {
        desasignadaPendiente = true;
        programar();
      }
      if (esEcoPropio(payload)) return;
      invalidar(
        seguimientoKeys.resumenes(),
        seguimientoKeys.progreso(asignacionId),
        seguimientoKeys.inactivas(asignacionId),
      );
    };

    const filtroAsignacion = `asignacion_id=eq.${asignacionId}`;
    const esquema = 'public';

    let canal = supabase.channel(`seguimiento:${asignacionId}`);

    canal = canal
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'materia_progreso', filter: filtroAsignacion },
        alProgreso,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'materia_progreso', filter: filtroAsignacion },
        alProgreso,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: esquema, table: 'materia_progreso' },
        alEliminar,
      );

    for (const tabla of TABLAS_HIJAS) {
      canal = canal
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: esquema, table: tabla, filter: filtroAsignacion },
          alHijo,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: esquema, table: tabla, filter: filtroAsignacion },
          alHijo,
        )
        .on('postgres_changes', { event: 'DELETE', schema: esquema, table: tabla }, alEliminar);
    }

    canal = canal
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: esquema,
          table: 'cedulario_asignaciones',
          filter: `id=eq.${asignacionId}`,
        },
        alAsignacion,
      )
      .subscribe((estado) => {
        if (cerrado) return;
        if (estado === 'SUBSCRIBED') {
          if (conProblemas) {
            conProblemas = false;
            // Missed events cannot be replayed: refresh everything of this assignment.
            invalidar(
              seguimientoKeys.resumenes(),
              seguimientoKeys.progreso(asignacionId),
              seguimientoKeys.inactivas(asignacionId),
              seguimientoKeys.actividad(asignacionId),
              ...detallesEnCache(),
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
      void supabase.removeChannel(canal);
    };
  }, [asignacionId, queryClient]);
}
