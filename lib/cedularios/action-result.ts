/**
 * Result shape shared by all cedularios Server Actions, plus the wrapper that
 * turns unexpected exceptions into `{ ok: false, error }`.
 *
 * Lives in `lib/cedularios` because a `'use server'` file may only export
 * async functions.
 */

import { toActionError, type CedularioErrorCode, type MapDbErrorContext } from './errors';

export interface ActionError {
  code: CedularioErrorCode;
  /** Interpolation params for the i18n message (for example a count). */
  params?: Record<string, string | number>;
  /** Field name to error code, shown below each invalid field. */
  fields?: Record<string, CedularioErrorCode>;
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionFail(
  code: CedularioErrorCode,
  extras: Pick<ActionError, 'params' | 'fields'> = {},
): { ok: false; error: ActionError } {
  const error: ActionError = { code };
  if (extras.params) error.params = extras.params;
  if (extras.fields) error.fields = extras.fields;
  return { ok: false, error };
}

type UserIdSource = string | null | undefined | (() => string | null | undefined);

export interface RunActionOptions {
  /** Operation name, for example `crearMateria`. */
  accion: string;
  /**
   * Acting user id. A function is evaluated when logging, so an action can
   * fill it in after `auth.getUser()`.
   */
  userId?: UserIdSource;
  /** Refines the mapping of thrown errors. */
  ctx?: MapDbErrorContext;
}

function resolverUserId(fuente: UserIdSource): string | null {
  try {
    const valor = typeof fuente === 'function' ? fuente() : fuente;
    return valor ?? null;
  } catch {
    return null;
  }
}

/**
 * Logs one failed operation. Only the operation name, the error code and the
 * user id are written; never messages, rich-text bodies or form values (Req 15.7).
 */
export function logActionError(accion: string, codigo: CedularioErrorCode, userId: string | null): void {
  try {
    console.error('[cedularios]', { accion, codigo, userId });
  } catch {
    // Logging must never break the action.
  }
}

/**
 * Runs `fn`, converts a thrown error into `{ ok: false, error }` and logs every
 * failure (thrown or returned). Never throws.
 */
export async function runAction<T>(
  options: RunActionOptions,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const { accion, userId, ctx } = options;
  let resultado: ActionResult<T>;

  try {
    resultado = await fn();
  } catch (excepcion) {
    const error = toActionError(excepcion, ctx);
    logActionError(accion, error.code, resolverUserId(userId));
    return { ok: false, error };
  }

  if (!resultado.ok) {
    logActionError(accion, resultado.error.code, resolverUserId(userId));
  }
  return resultado;
}
