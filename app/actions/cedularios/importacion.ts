'use server';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { errorDeDb, obtenerContextoStaff, parsear, tieneSqlstate } from '@/lib/cedularios/contexto-accion';
import type { CedularioErrorCode } from '@/lib/cedularios/errors';
import {
  importacionSchema,
  prepararMateriasRpc,
  type ImportacionInput,
} from '@/lib/cedularios/importacion/schema';
import type { Json } from '@/lib/supabase/types';

/**
 * Imports a reviewed cedulario tree in ONE database call (`importar_cedulario`, migration 155):
 * either everything is created or nothing is. The RPC runs as the caller (SECURITY INVOKER), so
 * RLS, the materias guards and the audit trail apply as for manual edits.
 *
 * The parser is deterministic and runs in the browser; this action only re-validates the payload
 * (structure, limits, unique sibling codes) and never trusts the client's ids.
 */
export async function importarCedulario(
  input: ImportacionInput,
): Promise<ActionResult<{ cedulario_id: string }>> {
  let userId: string | null = null;

  return runAction({ accion: 'importarCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(importacionSchema, input);
    if (!datos.ok) return datos;
    const { cedulario, cedulario_id, materias } = datos.data;

    const filas = prepararMateriasRpc(materias, () => crypto.randomUUID());

    const { data, error } = await supabase.rpc('importar_cedulario', {
      p_universidad_id: cedulario.universidad_id,
      p_nombre: cedulario.nombre,
      p_version: cedulario.version ?? null,
      p_descripcion: cedulario.descripcion ?? null,
      p_materias: filas as unknown as Json,
      ...(cedulario_id !== undefined ? { p_cedulario_id: cedulario_id } : {}),
    });

    if (error) {
      // Same i18n key as `cedularioSchema` when the universidad does not exist.
      if (tieneSqlstate(error, '23503')) {
        return actionFail('validacion', {
          fields: { universidad_id: 'universidad_invalida' as CedularioErrorCode },
        });
      }
      return errorDeDb(error);
    }
    if (typeof data !== 'string') return actionFail('error_generico');
    return actionOk({ cedulario_id: data });
  });
}
