/**
 * Autosave state machine for the cedulario rich-text editor (Req 13.11-13.13).
 *
 * Pure TypeScript: no React, no Supabase, no timers. The `useAutosave` hook owns
 * the timers and the Server Action call, and feeds this reducer with events.
 *
 * Contract between the hook and the reducer:
 *  - `edicion`: user changed the document. Restarts the 2000 ms period.
 *  - `inactividad_cumplida`: the inactivity timer fired. If 2000 ms really passed
 *    since the last edit, the state raises `solicitudGuardado` (see `debeGuardar`).
 *  - `guardado_iniciado`: the hook started the write (after seeing `debeGuardar`).
 *    The reducer snapshots the content being sent in `enVuelo`.
 *  - `guardado_exitoso` / `guardado_fallido`: result of the write.
 *  - `indicador_vencido`: the 1000 ms "Guardado" indicator timer fired.
 *  - `reintentar`: the user pressed Retry after an error.
 *  - `remoto_aplicado`: a remote change arrived. Applied only if the editor is clean.
 *  - `refrescar`: the user chose Refresh on the stale-content toast. Replaces local text.
 *  - `permiso_perdido`: the user can no longer edit. Autosave stops for good.
 */

export const AUTOSAVE_INACTIVIDAD_MS = 2000;
export const INDICADOR_GUARDADO_MS = 1000;

export type AutosaveFase = 'idle' | 'pendiente' | 'guardando' | 'guardado' | 'error';

export type AutosaveEstado = {
  /** Latest document held by the editor. */
  contenido: unknown;
  /** Last document confirmed as persisted. */
  guardado: unknown;
  /** True when `contenido` differs from `guardado`. */
  sucio: boolean;
  /** Timestamp (ms) of the latest edit that left the content dirty, or null. */
  ultimoCambioMs: number | null;
  fase: AutosaveFase;
  /** Document currently being written, or null when no write is in flight. */
  enVuelo: unknown;
  /** True when the inactivity period elapsed and the hook should start a write. */
  solicitudGuardado: boolean;
  /** True after the user lost edit rights. Nothing is ever sent from then on. */
  sinPermisos: boolean;
};

export type AutosaveEvento =
  | { tipo: 'edicion'; contenido: unknown; ahoraMs: number }
  | { tipo: 'inactividad_cumplida'; ahoraMs: number }
  | { tipo: 'guardado_iniciado' }
  | { tipo: 'guardado_exitoso' }
  | { tipo: 'guardado_fallido' }
  | { tipo: 'indicador_vencido' }
  | { tipo: 'reintentar' }
  | { tipo: 'remoto_aplicado'; contenido: unknown }
  | { tipo: 'refrescar'; contenido: unknown }
  | { tipo: 'permiso_perdido' };

/** Deep equality for JSON values (key order does not matter). */
export function contenidosIguales(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const aEsArray = Array.isArray(a);
  if (aEsArray !== Array.isArray(b)) return false;

  if (aEsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!contenidosIguales(arrA[i], arrB[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const clavesA = Object.keys(objA);
  if (clavesA.length !== Object.keys(objB).length) return false;
  for (const clave of clavesA) {
    if (!Object.prototype.hasOwnProperty.call(objB, clave)) return false;
    if (!contenidosIguales(objA[clave], objB[clave])) return false;
  }
  return true;
}

export function crearEstadoAutosave(contenidoInicial: unknown): AutosaveEstado {
  return {
    contenido: contenidoInicial,
    guardado: contenidoInicial,
    sucio: false,
    ultimoCambioMs: null,
    fase: 'idle',
    enVuelo: null,
    solicitudGuardado: false,
    sinPermisos: false,
  };
}

export function autosaveReducer(s: AutosaveEstado, ev: AutosaveEvento): AutosaveEstado {
  switch (ev.tipo) {
    case 'edicion': {
      // Read-only after permission loss: the unsaved text stays as it is.
      if (s.sinPermisos) return s;

      const sucio = !contenidosIguales(ev.contenido, s.guardado);

      if (s.fase === 'guardando') {
        // Keep the write in flight. A follow-up cycle is decided when it ends.
        return {
          ...s,
          contenido: ev.contenido,
          sucio,
          ultimoCambioMs: ev.ahoraMs,
          solicitudGuardado: false,
        };
      }

      if (!sucio) {
        return {
          ...s,
          contenido: ev.contenido,
          sucio: false,
          ultimoCambioMs: null,
          fase: s.fase === 'guardado' ? 'guardado' : 'idle',
          solicitudGuardado: false,
        };
      }

      return {
        ...s,
        contenido: ev.contenido,
        sucio: true,
        ultimoCambioMs: ev.ahoraMs,
        fase: 'pendiente',
        solicitudGuardado: false,
      };
    }

    case 'inactividad_cumplida': {
      if (s.sinPermisos || s.fase !== 'pendiente' || !s.sucio || s.ultimoCambioMs === null) {
        return s;
      }
      if (ev.ahoraMs - s.ultimoCambioMs < AUTOSAVE_INACTIVIDAD_MS) return s;
      if (contenidosIguales(s.contenido, s.guardado)) return s;
      return s.solicitudGuardado ? s : { ...s, solicitudGuardado: true };
    }

    case 'guardado_iniciado': {
      if (s.sinPermisos || s.fase !== 'pendiente' || !s.solicitudGuardado) return s;
      return {
        ...s,
        fase: 'guardando',
        enVuelo: s.contenido,
        solicitudGuardado: false,
      };
    }

    case 'guardado_exitoso': {
      if (s.fase !== 'guardando') return s;
      const guardado = s.enVuelo === null ? s.guardado : s.enVuelo;
      const sucio = !contenidosIguales(s.contenido, guardado);
      const base = { ...s, guardado, sucio, enVuelo: null, solicitudGuardado: false };

      if (s.sinPermisos) {
        // The write was already sent. Keep any newer text, but do not follow up.
        return { ...base, fase: 'idle' };
      }
      if (sucio) {
        // Edits arrived during the save: follow-up cycle, counted from the last edit.
        return { ...base, fase: 'pendiente' };
      }
      return { ...base, fase: 'guardado', ultimoCambioMs: null };
    }

    case 'guardado_fallido': {
      if (s.fase !== 'guardando') return s;
      const base = { ...s, enVuelo: null, solicitudGuardado: false };
      if (s.sinPermisos) return { ...base, fase: 'idle' };
      // Unsaved content stays in state for Retry or the next edit.
      return { ...base, fase: 'error', sucio: true };
    }

    case 'indicador_vencido': {
      return s.fase === 'guardado' ? { ...s, fase: 'idle' } : s;
    }

    case 'reintentar': {
      if (s.sinPermisos || s.fase !== 'error' || !s.sucio) return s;
      return { ...s, fase: 'pendiente', solicitudGuardado: true };
    }

    case 'remoto_aplicado': {
      // Only a fully clean editor takes remote content silently.
      if (s.sucio || s.fase === 'guardando' || s.fase === 'pendiente') return s;
      return {
        ...s,
        contenido: ev.contenido,
        guardado: ev.contenido,
        sucio: false,
        ultimoCambioMs: null,
        fase: 'idle',
        solicitudGuardado: false,
      };
    }

    case 'refrescar': {
      return {
        ...s,
        contenido: ev.contenido,
        guardado: ev.contenido,
        sucio: false,
        ultimoCambioMs: null,
        // A write in flight still ends with its own result event.
        fase: s.fase === 'guardando' ? 'guardando' : 'idle',
        enVuelo: null,
        solicitudGuardado: false,
      };
    }

    case 'permiso_perdido': {
      if (s.sinPermisos) return s;
      return {
        ...s,
        sinPermisos: true,
        solicitudGuardado: false,
        fase: s.fase === 'guardando' ? 'guardando' : 'idle',
      };
    }

    default: {
      const _exhaustivo: never = ev;
      return _exhaustivo;
    }
  }
}

/** True when the hook must start a write now. */
export function debeGuardar(s: AutosaveEstado): boolean {
  return (
    !s.sinPermisos &&
    s.fase === 'pendiente' &&
    s.sucio &&
    s.solicitudGuardado &&
    !contenidosIguales(s.contenido, s.guardado)
  );
}

/**
 * True while a write is in flight and the editor already holds newer content,
 * so a follow-up save cycle will be needed after the current one succeeds.
 */
export function necesitaSeguimiento(s: AutosaveEstado): boolean {
  return (
    !s.sinPermisos &&
    s.fase === 'guardando' &&
    s.enVuelo !== null &&
    !contenidosIguales(s.contenido, s.enVuelo)
  );
}

/**
 * Milliseconds the hook should wait before firing `inactividad_cumplida`,
 * or null when no timer is needed.
 */
export function msHastaGuardar(s: AutosaveEstado, ahoraMs: number): number | null {
  if (s.sinPermisos || s.fase !== 'pendiente' || !s.sucio || s.ultimoCambioMs === null) {
    return null;
  }
  return Math.max(0, s.ultimoCambioMs + AUTOSAVE_INACTIVIDAD_MS - ahoraMs);
}

/** True while the "Guardado" indicator must be visible (hook arms a 1000 ms timer). */
export function indicadorGuardadoVisible(s: AutosaveEstado): boolean {
  return s.fase === 'guardado';
}

/** True when there is text that was not persisted. */
export function hayCambiosSinGuardar(s: AutosaveEstado): boolean {
  return s.sucio;
}
