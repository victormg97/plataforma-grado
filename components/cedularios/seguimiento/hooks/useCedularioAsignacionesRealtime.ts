'use client';

/**
 * Realtime invalidation channel for the "Alumnos" tab of one cedulario (Req 25.8, 27.5).
 *
 * - One channel `seguimiento-cedulario:<id>` subscribed only to `cedulario_asignaciones`,
 *   filtered by `cedulario_id`. Same structure as `useCedularioRealtime` of phase 1.
 * - Payloads are signals only; the affected queries are invalidated and refetched.
 * - Invalidations are debounced 300 ms after the last signal.
 * - Events written by the current user (`updated_by`, or `asignado_por` on INSERT) are ignored,
 *   because the local mutations already invalidate the cache.
 * - After a reconnect every list of the cedulario is invalidated.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import { REALTIME_DEBOUNCE_MS } from '@/components/cedularios/hooks/useCedularioRealtime';

type Fila = Record<string, unknown>;
type Payload = RealtimePostgresChangesPayload<Fila>;

function leerString(fila: Fila | undefined, campo: string): string | undefined {
  const valor = fila?.[campo];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

export function useCedularioAsignacionesRealtime(cedularioId: string | null | undefined): void {
  const queryClient = useQueryClient();
  const userId = useUserStore((s) => s.user?.id ?? null);

  const userIdRef = useRef<string | null>(userId);
  useEffect(() => {
    userIdRef.current = userId;
  });

  useEffect(() => {
    if (!cedularioId) return;

    const supabase = createClient();
    const claves = new Map<string, QueryKey>();
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let cerrado = false;
    let conProblemas = false;

    const prefijoAlumnos = [...seguimientoKeys.alumnosTodos(), cedularioId] as const;
    const prefijoAsignables = [...seguimientoKeys.all, 'asignables', cedularioId] as const;

    const vaciar = () => {
      temporizador = null;
      if (cerrado) return;
      const pendientes = [...claves.values()];
      claves.clear();
      for (const queryKey of pendientes) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const programar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(vaciar, REALTIME_DEBOUNCE_MS);
    };

    const invalidar = (...lista: QueryKey[]) => {
      for (const clave of lista) claves.set(JSON.stringify(clave), clave);
      programar();
    };

    const esEcoPropio = (payload: Payload): boolean => {
      const yo = userIdRef.current;
      if (!yo) return false;
      const nueva = payload.new as Fila | undefined;
      const autor =
        payload.eventType === 'INSERT'
          ? (leerString(nueva, 'asignado_por') ?? leerString(nueva, 'updated_by'))
          : leerString(nueva, 'updated_by');
      return autor === yo;
    };

    const alAsignacion = (payload: Payload) => {
      if (esEcoPropio(payload)) return;
      const alumnoId = leerString(payload.new as Fila, 'alumno_id');
      invalidar(prefijoAlumnos, prefijoAsignables);
      invalidar(alumnoId ? seguimientoKeys.resumen(alumnoId) : seguimientoKeys.resumenes());
    };

    const filter = `cedulario_id=eq.${cedularioId}`;
    const esquema = 'public';

    const canal = supabase
      .channel(`seguimiento-cedulario:${cedularioId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: esquema, table: 'cedulario_asignaciones', filter },
        alAsignacion,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: esquema, table: 'cedulario_asignaciones', filter },
        alAsignacion,
      )
      .subscribe((estado) => {
        if (cerrado) return;
        if (estado === 'SUBSCRIBED') {
          if (conProblemas) {
            conProblemas = false;
            // Missed events cannot be replayed: refresh everything of this cedulario.
            invalidar(prefijoAlumnos, prefijoAsignables, seguimientoKeys.resumenes());
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
  }, [cedularioId, queryClient]);
}
