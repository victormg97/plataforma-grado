'use client';

/**
 * Presence for the materia editors (Req 18.5).
 *
 * Uses a separate channel `cedulario-presence:<id>` (not the `cedulario:<id>` postgres_changes
 * channel): presence has its own lifecycle (track/untrack on focus, leave on disconnect) and
 * keeping it apart avoids re-tracking whenever the invalidation channel reconnects. Both
 * channels are scoped to one cedulario and share the cedulario UUID in their name.
 * The payload holds only the user id and display name (plus the materia id being edited).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';

export interface CedularioPresenceUser {
  userId: string;
  nombre: string;
}

interface PresenciaPayload {
  userId: string;
  nombre: string;
  materiaId: string | null;
}

export interface UseCedularioPresenceResult {
  /** Other users (never the current user) whose editor has focus on the same materia. */
  editores: CedularioPresenceUser[];
  /** Call with true on editor focus and false on blur or close. Cleared automatically on unmount. */
  setEditing: (editando: boolean) => void;
}

function esPayload(valor: unknown): valor is PresenciaPayload {
  if (!valor || typeof valor !== 'object') return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.userId === 'string' &&
    typeof v.nombre === 'string' &&
    (typeof v.materiaId === 'string' || v.materiaId === null)
  );
}

export function useCedularioPresence(
  cedularioId: string | null | undefined,
  materiaId: string | null,
): UseCedularioPresenceResult {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const nombre = useUserStore((s) => {
    const u = s.user;
    return u ? [u.nombre, u.apellido].filter(Boolean).join(' ').trim() : '';
  });

  const [presentes, setPresentes] = useState<PresenciaPayload[]>([]);
  const [editando, setEditandoState] = useState(false);
  // Counter bumped on (re)subscribe so the tracking effect runs once the channel is ready.
  const [reintento, setReintento] = useState(0);

  const canalRef = useRef<RealtimeChannel | null>(null);
  const suscritoRef = useRef(false);
  /** Last tracked state: serialized payload, or null when untracked. */
  const rastreadoRef = useRef<string | null>(null);

  const setEditing = useCallback((valor: boolean) => setEditandoState(valor), []);

  // Channel lifecycle: one presence channel per open cedulario.
  useEffect(() => {
    if (!cedularioId || !userId) return;

    const supabase = createClient();
    const canal = supabase.channel(`cedulario-presence:${cedularioId}`, {
      config: { presence: { key: userId } },
    });
    canalRef.current = canal;
    suscritoRef.current = false;
    rastreadoRef.current = null;
    let cerrado = false;

    const sincronizar = () => {
      if (cerrado) return;
      const estado = canal.presenceState<Record<string, unknown>>();
      const lista: PresenciaPayload[] = [];
      for (const metas of Object.values(estado)) {
        for (const meta of metas) {
          if (esPayload(meta)) {
            lista.push({ userId: meta.userId, nombre: meta.nombre, materiaId: meta.materiaId });
          }
        }
      }
      setPresentes(lista);
    };

    canal.on('presence', { event: 'sync' }, sincronizar).subscribe((estado) => {
      if (cerrado) return;
      if (estado === 'SUBSCRIBED') {
        suscritoRef.current = true;
        // Force the tracking effect to re-run its logic after (re)subscribing.
        rastreadoRef.current = null;
        setReintento((n) => n + 1);
      } else if (estado === 'CLOSED' || estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        suscritoRef.current = false;
        rastreadoRef.current = null;
      }
    });

    return () => {
      cerrado = true;
      suscritoRef.current = false;
      rastreadoRef.current = null;
      canalRef.current = null;
      setPresentes([]);
      void supabase.removeChannel(canal); // removing the channel also leaves presence
    };
  }, [cedularioId, userId]);

  // Track while a materia editor has focus; untrack on blur, close or materia change.
  useEffect(() => {
    const canal = canalRef.current;
    if (!canal || !suscritoRef.current || !userId) return;

    if (editando && materiaId) {
      const payload: PresenciaPayload = { userId, nombre, materiaId };
      const serializado = JSON.stringify(payload);
      if (rastreadoRef.current === serializado) return;
      rastreadoRef.current = serializado;
      void canal.track(payload);
    } else if (rastreadoRef.current !== null) {
      rastreadoRef.current = null;
      void canal.untrack();
    }
  }, [editando, materiaId, userId, nombre, cedularioId, reintento]);

  const editores = useMemo(() => {
    if (!materiaId) return [];
    const vistos = new Map<string, CedularioPresenceUser>();
    for (const p of presentes) {
      if (p.materiaId !== materiaId || p.userId === userId) continue;
      if (!vistos.has(p.userId)) vistos.set(p.userId, { userId: p.userId, nombre: p.nombre });
    }
    return [...vistos.values()];
  }, [presentes, materiaId, userId]);

  return { editores, setEditing };
}
