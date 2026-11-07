/**
 * Error helpers for the student tracking module (phase 2).
 *
 * Pure TypeScript: no React, no Supabase client.
 */

import {
  esCodigoDeError,
  leerConteoDeDetalles,
  mapDbError,
  type CedularioErrorCode,
} from '../errors';

/**
 * Reasons a single student can be rejected in a multi-student assignment.
 * Same table as `seg_motivo_de_sqlstate` in migration 154: anything else is `error_generico`.
 */
const MOTIVOS_DE_RECHAZO: ReadonlySet<CedularioErrorCode> = new Set<CedularioErrorCode>([
  'asignacion_duplicada',
  'alumno_no_valido',
  'cedulario_no_disponible',
  'sin_permisos',
  'error_conexion',
]);

function aMotivo(codigo: CedularioErrorCode): CedularioErrorCode {
  return MOTIVOS_DE_RECHAZO.has(codigo) ? codigo : 'error_generico';
}

/**
 * Maps the cause of a per-student rejection to a `CedularioErrorCode`.
 * Accepts the `motivo` text returned by the `asignar_cedulario_alumnos` RPC (already a code),
 * a bare SQLSTATE string (`CD010`, `CD011`, `CD016`, `42501`), or any thrown error.
 * Total: never throws.
 */
export function motivoDeRechazo(error: unknown): CedularioErrorCode {
  try {
    if (typeof error === 'string') {
      const texto = error.trim();
      if (esCodigoDeError(texto)) return aMotivo(texto);
      return aMotivo(mapDbError({ code: texto }));
    }
    return aMotivo(mapDbError(error));
  } catch {
    return 'error_generico';
  }
}

/**
 * Number of students carried in the `DETAIL` of a CD008 error (`error.details`).
 * Returns `undefined` when absent or not a non-negative integer.
 */
export function conteoDeDetalle(error: unknown): number | undefined {
  try {
    return leerConteoDeDetalles(error);
  } catch {
    return undefined;
  }
}
