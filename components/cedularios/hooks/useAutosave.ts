'use client';

/**
 * Autosave hook for the cedulario rich-text editors (normativa, rúbrica, temario).
 *
 * Drives the pure `autosaveReducer` with timers and a caller-supplied save
 * function. The hook never calls Server Actions itself, so the same code serves
 * every rich-text field (Req 13.11-13.13).
 *
 * - 2000 ms without edits, then one save. "Guardado" shows for 1000 ms.
 * - Edits during a save stay dirty and trigger a follow-up cycle.
 * - On failure the unsaved content stays in state; Retry or the next edit re-sends it.
 * - On unmount (tab switch, panel or modal closed) any unsaved content, including content left
 *   after a failed save, is sent once through guardar without waiting for the 2000 ms. It is
 *   fire-and-forget: the result is ignored and nothing is dispatched after unmount. The write
 *   is queued behind a save still in flight so the older document cannot overwrite the newer one.
 *   Nothing is flushed after permission loss. If the whole page is closed instead, a
 *   `beforeunload` prompt is registered while there are unsaved changes (best effort; the
 *   browser may still discard a request that has not finished).
 * - When edit rights are lost, nothing is sent any more and the text stays visible
 *   (Req 18.10, 6.13). Regaining rights requires remounting the hook (use a `key`).
 * - Remote changes (Req 18.6-18.8): applied silently when the editor is clean;
 *   otherwise `contenidoRemotoPendiente` becomes true and local text is kept until
 *   the user calls `refrescar()`. Without that, last write wins.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { ActionError, ActionResult } from '@/lib/cedularios/action-result';
import {
  autosaveReducer,
  contenidosIguales,
  crearEstadoAutosave,
  debeGuardar,
  hayCambiosSinGuardar as hayCambiosSinGuardarEstado,
  indicadorGuardadoVisible,
  INDICADOR_GUARDADO_MS,
  msHastaGuardar,
  type AutosaveEstado,
  type AutosaveEvento,
  type AutosaveFase,
} from '@/lib/cedularios/autosave';
import type { TiptapDoc } from '@/lib/cedularios/richtext';

/** Document handled by the editor. `null` means the field is empty in the database. */
export type ContenidoAutosave = TiptapDoc | null;

export interface UseAutosaveOptions {
  /** Content loaded from the database when the editor opens. */
  contenidoInicial: ContenidoAutosave;
  /** Persists the document. Supplied by the caller (a Server Action wrapper). */
  guardar: (doc: ContenidoAutosave) => Promise<ActionResult<unknown>>;
  /** False once the user can no longer edit: autosave stops, unsaved text stays. */
  puedeEditar: boolean;
  /**
   * Latest content known from the server (query data or Realtime refetch).
   * `undefined` means "no information"; `null` means an empty remote field.
   * Equivalent to calling `notifyRemoteContent` whenever the value changes.
   */
  remoto?: ContenidoAutosave;
  /** Called once when a save is rejected with `sin_permisos`, so the caller can go read-only. */
  alPerderPermiso?: () => void;
}

export interface UseAutosaveResult {
  /** Reducer phase: `idle | pendiente | guardando | guardado | error`. */
  fase: AutosaveFase;
  /** Document the editor should hold right now. */
  contenido: ContenidoAutosave;
  /** The editor calls this on every edit. Ignored after permission loss. */
  setContenido: (doc: ContenidoAutosave) => void;
  /** Re-sends the unsaved content after an error. */
  reintentar: () => void;
  /**
   * Replaces local content with the latest remote content (or the last saved
   * content if none is pending) and discards unsaved edits.
   */
  refrescar: () => void;
  /** Reports remote content (for example from a Realtime-triggered refetch). */
  notifyRemoteContent: (doc: ContenidoAutosave) => void;
  /** True when remote content arrived while dirty/saving: show the stale-content toast. */
  contenidoRemotoPendiente: boolean;
  /** True when there is text that was not persisted. */
  hayCambiosSinGuardar: boolean;
  /** Save error to translate in the editor, only while `fase === 'error'`. */
  error: ActionError | null;
  /** True while the "Guardado" indicator must show (fase === 'guardado'). */
  guardadoVisible: boolean;
  /** True after edit rights were lost. */
  sinPermisos: boolean;
  /**
   * Increments each time the content is replaced from outside the editor
   * (silent remote apply or refrescar), so the editor can call `setContent`.
   */
  revisionExterna: number;
}

type EstadoInterno = {
  nucleo: AutosaveEstado;
  remotoPendiente: boolean;
  remotoContenido: unknown;
  error: ActionError | null;
  revisionExterna: number;
};

type EventoInterno =
  | Exclude<AutosaveEvento, { tipo: 'remoto_aplicado' | 'refrescar' | 'guardado_fallido' }>
  | { tipo: 'guardado_fallido'; error: ActionError }
  | { tipo: 'remoto_notificado'; contenido: unknown }
  | { tipo: 'refrescar_solicitado' };

function crearEstadoInterno(contenidoInicial: ContenidoAutosave): EstadoInterno {
  return {
    nucleo: crearEstadoAutosave(contenidoInicial),
    remotoPendiente: false,
    remotoContenido: undefined,
    error: null,
    revisionExterna: 0,
  };
}

function reducerInterno(s: EstadoInterno, ev: EventoInterno): EstadoInterno {
  const n = s.nucleo;

  switch (ev.tipo) {
    case 'remoto_notificado': {
      // Echo of our own content (saved, in flight or current): nothing to do.
      if (
        contenidosIguales(ev.contenido, n.guardado) ||
        contenidosIguales(ev.contenido, n.contenido) ||
        (n.enVuelo !== null && contenidosIguales(ev.contenido, n.enVuelo))
      ) {
        return s;
      }
      const ocupado = n.sucio || n.fase === 'guardando' || n.fase === 'pendiente';
      if (ocupado) {
        // Keep local text. Remember the latest remote document for refrescar().
        return { ...s, remotoPendiente: true, remotoContenido: ev.contenido };
      }
      return {
        ...s,
        nucleo: autosaveReducer(n, { tipo: 'remoto_aplicado', contenido: ev.contenido }),
        remotoPendiente: false,
        remotoContenido: undefined,
        error: null,
        revisionExterna: s.revisionExterna + 1,
      };
    }

    case 'refrescar_solicitado': {
      const contenido = s.remotoPendiente ? s.remotoContenido : n.guardado;
      return {
        ...s,
        nucleo: autosaveReducer(n, { tipo: 'refrescar', contenido }),
        remotoPendiente: false,
        remotoContenido: undefined,
        error: null,
        revisionExterna: s.revisionExterna + 1,
      };
    }

    case 'guardado_fallido': {
      return {
        ...s,
        nucleo: autosaveReducer(n, { tipo: 'guardado_fallido' }),
        error: ev.error,
      };
    }

    default: {
      const nucleo = autosaveReducer(n, ev);
      // Our own write landed and nothing newer is pending: last write wins,
      // so an older remote document must not be offered via Refresh.
      const limpiaRemoto =
        s.remotoPendiente && ev.tipo === 'guardado_exitoso' && !nucleo.sucio;
      if (nucleo === n && !limpiaRemoto) return s;
      return {
        ...s,
        nucleo,
        remotoPendiente: limpiaRemoto ? false : s.remotoPendiente,
        remotoContenido: limpiaRemoto ? undefined : s.remotoContenido,
        error: ev.tipo === 'guardado_exitoso' ? null : s.error,
      };
    }
  }
}

export function useAutosave({
  contenidoInicial,
  guardar,
  puedeEditar,
  remoto,
  alPerderPermiso,
}: UseAutosaveOptions): UseAutosaveResult {
  const [interno, dispatchReact] = useReducer(reducerInterno, contenidoInicial, crearEstadoInterno);
  const { nucleo } = interno;

  /**
   * Latest reducer state, advanced synchronously with every dispatch (the reducer is pure), so the
   * unmount flush sees an edit even if the component unmounts before React re-renders.
   */
  const ultimoEstadoRef = useRef<EstadoInterno>(interno);
  const dispatch = useCallback((ev: EventoInterno) => {
    ultimoEstadoRef.current = reducerInterno(ultimoEstadoRef.current, ev);
    dispatchReact(ev);
  }, []);
  const montadoRef = useRef(false);
  const guardarRef = useRef(guardar);
  const alPerderPermisoRef = useRef(alPerderPermiso);
  /** Document of the write already sent, so an effect re-run never sends it twice. */
  const enviadoRef = useRef<unknown>(null);
  /** Promise of the write in flight, so the unmount flush is sent after it. */
  const vueloRef = useRef<Promise<void> | null>(null);
  /** Document already sent by the unmount flush (wrapped, because `null` is a valid document). */
  const vaciadoRef = useRef<{ doc: ContenidoAutosave } | null>(null);
  const puedeEditarRef = useRef(puedeEditar);
  useEffect(() => {
    guardarRef.current = guardar;
    alPerderPermisoRef.current = alPerderPermiso;
    puedeEditarRef.current = puedeEditar;
  });
  // Unmount flush: send unsaved content once, without waiting for the inactivity period.
  useEffect(() => {
    montadoRef.current = true;

    const vaciar = () => {
      const { nucleo: n } = ultimoEstadoRef.current;
      if (!puedeEditarRef.current || n.sinPermisos || !n.sucio) return;
      if (contenidosIguales(n.contenido, n.guardado)) return;
      // The same document is already being written.
      if (n.fase === 'guardando' && n.enVuelo !== null && contenidosIguales(n.contenido, n.enVuelo)) {
        return;
      }
      // Idempotent: never flush the same document twice.
      if (vaciadoRef.current !== null && contenidosIguales(vaciadoRef.current.doc, n.contenido)) {
        return;
      }

      const doc = n.contenido as ContenidoAutosave;
      vaciadoRef.current = { doc };
      const previo = vueloRef.current;
      void (async () => {
        try {
          if (previo) await previo;
          await guardarRef.current(doc);
        } catch {
          // Fire-and-forget: there is no UI left. `runAction` already logs failures.
        }
      })();
    };

    return () => {
      montadoRef.current = false;
      // React Strict Mode simulates an unmount and re-runs the effect synchronously. Deciding in a
      // microtask lets a remount cancel the flush; a real unmount keeps montadoRef false.
      queueMicrotask(() => {
        if (!montadoRef.current) vaciar();
      });
    };
  }, []);

  // Best-effort guard against closing the tab/page with unsaved changes.
  const sinGuardar = hayCambiosSinGuardarEstado(nucleo);
  useEffect(() => {
    if (!sinGuardar) return;
    const alDescargar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', alDescargar);
    return () => window.removeEventListener('beforeunload', alDescargar);
  }, [sinGuardar]);

  // Permission loss: autosave stops, unsaved text stays visible and is never sent.
  useEffect(() => {
    if (!puedeEditar) dispatch({ tipo: 'permiso_perdido' });
  }, [puedeEditar, dispatch]);

  // Remote content passed as an option.
  useEffect(() => {
    if (remoto !== undefined) dispatch({ tipo: 'remoto_notificado', contenido: remoto });
  }, [remoto, dispatch]);

  // Inactivity timer: fires `inactividad_cumplida` once 2000 ms passed since the last edit.
  // Also re-arms after a successful save when edits arrived during it.
  useEffect(() => {
    const espera = msHastaGuardar(nucleo, Date.now());
    if (espera === null) return;

    let temporizador: ReturnType<typeof setTimeout>;
    const armar = (ms: number) => {
      temporizador = setTimeout(() => {
        const ahoraMs = Date.now();
        const resto = msHastaGuardar(nucleo, ahoraMs);
        if (resto === null) return;
        if (resto > 0) {
          // Timer fired early: wait the remainder.
          armar(resto);
          return;
        }
        dispatch({ tipo: 'inactividad_cumplida', ahoraMs });
      }, ms);
    };
    armar(espera);

    return () => clearTimeout(temporizador);
  }, [nucleo, dispatch]);

  // The reducer raised a save request (inactivity elapsed, or Retry): start the write.
  useEffect(() => {
    if (debeGuardar(nucleo)) dispatch({ tipo: 'guardado_iniciado' });
  }, [nucleo, dispatch]);

  // Send the snapshot the reducer froze in `enVuelo`, then report the result.
  useEffect(() => {
    if (nucleo.enVuelo === null) {
      enviadoRef.current = null;
      return;
    }
    if (nucleo.fase !== 'guardando' || enviadoRef.current === nucleo.enVuelo) return;

    const doc = nucleo.enVuelo as ContenidoAutosave;
    enviadoRef.current = nucleo.enVuelo;

    const vuelo = (async () => {
      let resultado: ActionResult<unknown>;
      try {
        resultado = await guardarRef.current(doc);
      } catch {
        resultado = { ok: false, error: { code: 'error_conexion' } };
      }
      if (!montadoRef.current) return;

      if (resultado.ok) {
        dispatch({ tipo: 'guardado_exitoso' });
        return;
      }
      dispatch({ tipo: 'guardado_fallido', error: resultado.error });
      if (resultado.error.code === 'sin_permisos') {
        dispatch({ tipo: 'permiso_perdido' });
        alPerderPermisoRef.current?.();
      }
    })();
    vueloRef.current = vuelo;
    void vuelo.finally(() => {
      if (vueloRef.current === vuelo) vueloRef.current = null;
    });
  }, [nucleo.fase, nucleo.enVuelo, dispatch]);

  // "Guardado" indicator: visible for 1000 ms.
  const guardadoVisible = indicadorGuardadoVisible(nucleo);
  useEffect(() => {
    if (!guardadoVisible) return;
    const temporizador = setTimeout(() => dispatch({ tipo: 'indicador_vencido' }), INDICADOR_GUARDADO_MS);
    return () => clearTimeout(temporizador);
  }, [guardadoVisible, dispatch]);

  const setContenido = useCallback((doc: ContenidoAutosave) => {
    dispatch({ tipo: 'edicion', contenido: doc, ahoraMs: Date.now() });
  }, [dispatch]);

  const reintentar = useCallback(() => {
    dispatch({ tipo: 'reintentar' });
  }, [dispatch]);

  const refrescar = useCallback(() => {
    dispatch({ tipo: 'refrescar_solicitado' });
  }, [dispatch]);

  const notifyRemoteContent = useCallback((doc: ContenidoAutosave) => {
    dispatch({ tipo: 'remoto_notificado', contenido: doc });
  }, [dispatch]);

  return {
    fase: nucleo.fase,
    contenido: nucleo.contenido as ContenidoAutosave,
    setContenido,
    reintentar,
    refrescar,
    notifyRemoteContent,
    contenidoRemotoPendiente: interno.remotoPendiente,
    hayCambiosSinGuardar: sinGuardar,
    error: nucleo.fase === 'error' ? interno.error : null,
    guardadoVisible,
    sinPermisos: nucleo.sinPermisos,
    revisionExterna: interno.revisionExterna,
  };
}
