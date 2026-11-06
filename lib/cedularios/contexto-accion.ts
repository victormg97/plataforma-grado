/**
 * Shared helpers for the cedularios Server Actions (`universidades.ts` and
 * `cedularios.ts`). Lives in `lib/cedularios` because a `'use server'` file may
 * only export async functions.
 *
 * Server-only: it uses the `@supabase/ssr` server client, which reads the request
 * cookies. The service role is never used; every call runs as the signed-in user.
 */

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

import { actionFail, actionOk, type ActionError, type ActionResult } from './action-result';
import { mapDbError, toActionError, type CedularioErrorCode, type MapDbErrorContext } from './errors';

// ---------------------------------------------------------------------------
// Row and result types returned by the universidades / cedularios actions
// ---------------------------------------------------------------------------

export type UniversidadRow = Database['public']['Tables']['universidades']['Row'];
export type CedularioRow = Database['public']['Tables']['cedularios']['Row'];

/** Result of `eliminarCedulario`. */
export type ResultadoEliminarCedulario =
  | { eliminado: true }
  | { eliminado: false; requiereConfirmacion: { materias: number } };

/** Rich-text columns of `cedularios` editable through `guardarContenidoCedulario`. */
export type CampoContenidoCedulario = 'normativa' | 'rubrica';

// ---------------------------------------------------------------------------
// Authentication and role check
// ---------------------------------------------------------------------------

export type SupabaseAccion = Awaited<ReturnType<typeof createClient>>;

export interface ContextoStaff {
  supabase: SupabaseAccion;
  userId: string;
  rol: 'admin' | 'profesor';
}

export type Fallo = { ok: false; error: ActionError };

/**
 * Creates the server client, reads the signed-in user and checks that the role in
 * `profiles` is admin or profesor. Anything else is `sin_permisos`. This check only
 * gives a friendlier error; RLS stays the real authority.
 *
 * Connection failures while reading the session or the profile are reported as
 * `error_conexion`; an unexpected database error is thrown so `runAction` maps it.
 */
export async function obtenerContextoStaff(): Promise<ActionResult<ContextoStaff>> {
  const supabase = await createClient();

  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  const user = sesion?.user ?? null;

  if (errorSesion || !user) {
    // A missing or expired session is not an error code of its own: it means "no access".
    const codigo = errorSesion ? mapDbError(errorSesion) : 'sin_permisos';
    return actionFail(codigo === 'error_generico' ? 'sin_permisos' : codigo);
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (errorPerfil) return errorDeDb(errorPerfil);

  const rol = perfil?.rol;
  if (rol !== 'admin' && rol !== 'profesor') return actionFail('sin_permisos');

  return actionOk<ContextoStaff>({ supabase, userId: user.id, rol });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Parses `input` with a Zod schema. On failure returns `validacion` with one entry
 * per invalid field in `fields`; each value is the i18n key chosen in `schemas.ts`
 * (relative to `cedularios.errores`). Issues without a path go under `campoRaiz`.
 */
export function parsear<S extends z.ZodType>(
  schema: S,
  input: unknown,
  campoRaiz?: string,
): ActionResult<z.output<S>> {
  const resultado = schema.safeParse(input);
  if (resultado.success) return actionOk<z.output<S>>(resultado.data);

  const fields: Record<string, CedularioErrorCode> = {};
  for (const issue of resultado.error.issues) {
    const primero = issue.path[0];
    const campo = typeof primero === 'string' ? primero : campoRaiz;
    if (campo === undefined || campo in fields) continue;
    // The schema messages are i18n keys of the `errores` block. `ActionError.fields`
    // is typed with the error-code union, but the field keys (for example
    // `nombre_requerido`) live in the same namespace, so the cast is only a typing gap.
    fields[campo] = issue.message as CedularioErrorCode;
  }

  return Object.keys(fields).length > 0 ? actionFail('validacion', { fields }) : actionFail('validacion');
}

const idSchema = z.guid();

/** Validates a record id (any 8-4-4-4-12 hex id). */
export function parsearId(id: unknown): ActionResult<string> {
  const resultado = idSchema.safeParse(id);
  return resultado.success ? actionOk<string>(resultado.data) : actionFail('validacion');
}

// ---------------------------------------------------------------------------
// Database errors
// ---------------------------------------------------------------------------

/** Maps a database error to a failed `ActionResult` (never throws). */
export function errorDeDb(error: unknown, ctx: MapDbErrorContext = {}): Fallo {
  return { ok: false, error: toActionError(error, ctx) };
}

/** True when a PostgREST/Postgres error carries the given SQLSTATE. */
export function tieneSqlstate(error: unknown, sqlstate: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === sqlstate
  );
}
