// Autorización pura de creación de enlaces y resolución del profesor asociado.

import type {
  Actor,
  ResultadoAutorizacion,
  SolicitudCreacion,
  TipoEnlace,
} from './types';

const TIPOS_VALIDOS: TipoEnlace[] = ['profesor', 'alumno', 'lector'];

function esTipoValido(tipo: string): tipo is TipoEnlace {
  return (TIPOS_VALIDOS as string[]).includes(tipo);
}

/**
 * Decide si un actor puede crear el enlace solicitado y, en caso afirmativo,
 * deriva los campos del enlace a persistir. Nunca devuelve un enlace cuando
 * rechaza (un rechazo implica "no persistir").
 *
 * - admin: cualquier tipo; `created_by = actor`, `estado = 'activo'`.
 * - profesor con `puede_crear_alumno` y `tipo = 'alumno'`: `created_by = actor`,
 *   `profesor_asignado = actor`, `estado = 'activo'`.
 * - cualquier otro caso: rechazo de autorización.
 */
export function authorizeCreate(
  actor: Actor,
  solicitud: SolicitudCreacion,
): ResultadoAutorizacion {
  if (!esTipoValido(solicitud.tipo)) {
    return { ok: false, motivo: 'tipo_invalido' };
  }

  if (actor.rol === 'admin') {
    return {
      ok: true,
      enlace: {
        tipo: solicitud.tipo,
        created_by: actor.id,
        profesor_asignado:
          solicitud.tipo === 'alumno' ? solicitud.profesor_asignado ?? null : null,
        estado: 'activo',
      },
    };
  }

  if (actor.rol === 'profesor' && actor.puede_crear_alumno) {
    if (solicitud.tipo !== 'alumno') {
      return { ok: false, motivo: 'tipo_no_permitido' };
    }
    return {
      ok: true,
      enlace: {
        tipo: 'alumno',
        created_by: actor.id,
        profesor_asignado: actor.id,
        estado: 'activo',
      },
    };
  }

  return { ok: false, motivo: 'rol_no_autorizado' };
}

export interface ProfesorCandidato {
  id: string;
  rol: string;
  activo: boolean;
}

/**
 * Resuelve el profesor que debe asociarse a un alumno creado mediante un enlace.
 * Devuelve el id si y solo si el profesor existe, está activo y tiene rol
 * `profesor` o `admin`. En cualquier otro caso devuelve `null` (alumno creado
 * sin asociación).
 */
export function resolverProfesorAsociado(
  profesor: ProfesorCandidato | null | undefined,
): string | null {
  if (!profesor) return null;
  if (!profesor.activo) return null;
  if (profesor.rol !== 'profesor' && profesor.rol !== 'admin') return null;
  return profesor.id;
}
