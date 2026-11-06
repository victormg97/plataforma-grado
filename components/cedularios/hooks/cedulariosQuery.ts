/**
 * Shared helpers of the cedularios data hooks: typed query errors, retry policy and
 * key prefixes used for invalidation.
 *
 * Query functions in `lib/queries/cedularios` throw the raw Supabase error. The hooks wrap
 * them in a `CedulariosQueryError` whose `code` comes from `mapDbError`, so the UI can show
 * `cedularios.errores.<code>` without knowing about Postgres.
 */

import { cedulariosKeys, type EnlaceScope } from '@/lib/cedularios/keys';
import { mapDbError, type CedularioErrorCode } from '@/lib/cedularios/errors';

export class CedulariosQueryError extends Error {
  readonly code: CedularioErrorCode;
  readonly original: unknown;

  constructor(code: CedularioErrorCode, original: unknown) {
    super(code);
    this.name = 'CedulariosQueryError';
    this.code = code;
    this.original = original;
  }
}

/** Runs a query function and converts anything it throws into a `CedulariosQueryError`. */
export async function consultar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CedulariosQueryError) throw error;
    throw new CedulariosQueryError(mapDbError(error), error);
  }
}

/** Error code of any error thrown by a cedularios query hook. */
export function codigoDeError(error: unknown): CedularioErrorCode {
  return error instanceof CedulariosQueryError ? error.code : mapDbError(error);
}

/** Codes where a retry cannot help: the answer will be the same. */
const SIN_REINTENTO: ReadonlySet<CedularioErrorCode> = new Set<CedularioErrorCode>([
  'sin_permisos',
  'validacion',
]);

/** React Query `retry`: one retry (project default), none for permission and validation errors. */
export function reintentarConsulta(failureCount: number, error: unknown): boolean {
  if (SIN_REINTENTO.has(codigoDeError(error))) return false;
  return failureCount < 1;
}

// ---------------------------------------------------------------------------
// Key prefixes (invalidateQueries matches by prefix)
// ---------------------------------------------------------------------------

/** Every historial query of every cedulario and filter. */
export const HISTORIAL_ROOT = [...cedulariosKeys.all, 'historial'] as const;

/** Every cedulario detail (it embeds the universidad name and logo). */
export const DETALLE_ROOT = [...cedulariosKeys.all, 'detalle'] as const;

/** The materia structure of every cedulario (does not match `['cedularios','materia', id]`). */
export const MATERIAS_ROOT = [...cedulariosKeys.all, 'materias'] as const;

/** Every enlaces list of one scope. */
export function enlacesScopeKey(scope: EnlaceScope) {
  return [...cedulariosKeys.all, 'enlaces', scope] as const;
}
