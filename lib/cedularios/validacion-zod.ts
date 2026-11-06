/**
 * Converts a Zod validation failure into the `ActionError` shape used by the
 * cedularios Server Actions.
 *
 * Pure TypeScript: no React, no Supabase client.
 *
 * The schemas in `schemas.ts` use field-specific i18n keys as messages (for
 * example `nombre_requerido`). `ActionError.fields` only carries
 * `CedularioErrorCode` values, so a message that is already a code (for example
 * `url_invalida`) is kept and any other message becomes `validacion`. The form
 * shows the precise per-field message from the client-side schema.
 */

import type { ZodError } from 'zod';

import type { ActionError } from './action-result';
import { esCodigoDeError, type CedularioErrorCode } from './errors';

/**
 * @param error Zod error from `safeParse`.
 * @param campoPorDefecto Field name used for issues that have no path (a schema applied to a single value).
 */
export function zodAActionError(error: ZodError, campoPorDefecto?: string): ActionError {
  const fields: Record<string, CedularioErrorCode> = {};

  for (const issue of error.issues) {
    const primero = issue.path[0];
    const campo = primero === undefined ? campoPorDefecto : String(primero);
    if (campo === undefined || campo in fields) continue;
    fields[campo] = esCodigoDeError(issue.message) ? issue.message : 'validacion';
  }

  const resultado: ActionError = { code: 'validacion' };
  if (Object.keys(fields).length > 0) resultado.fields = fields;
  return resultado;
}
