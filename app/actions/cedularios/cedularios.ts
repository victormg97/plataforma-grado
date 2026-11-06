'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import {
  errorDeDb,
  obtenerContextoStaff,
  parsear,
  parsearId,
  tieneSqlstate,
  type CampoContenidoCedulario,
  type CedularioRow,
  type Fallo,
  type ResultadoEliminarCedulario,
} from '@/lib/cedularios/contexto-accion';
import { evaluarEliminacionCedulario } from '@/lib/cedularios/eliminacion';
import type { CedularioErrorCode } from '@/lib/cedularios/errors';
import { sanitizeDoc, type TiptapDoc } from '@/lib/cedularios/richtext';
import { cedularioSchema, tiptapDocSinTablasSchema, type CedularioInput } from '@/lib/cedularios/schemas';
import type { Json } from '@/lib/supabase/types';

/** `universidad_id` is optional when editing: it is only sent when the user changes it. */
const cedularioEdicionSchema = cedularioSchema.partial({ universidad_id: true });

const campoContenidoSchema = z.enum(['normativa', 'rubrica']);
const opcionesEliminarSchema = z.object({ confirmado: z.boolean().optional() });

/** A foreign key violation on `universidad_id` means the universidad does not exist (Req 2.2). */
function fallaDeCedulario(error: unknown): Fallo {
  if (tieneSqlstate(error, '23503')) {
    // Same i18n key as `cedularioSchema` (`universidad_invalida`); see `parsear` for the cast.
    return {
      ok: false,
      error: { code: 'validacion', fields: { universidad_id: 'universidad_invalida' as CedularioErrorCode } },
    };
  }
  return errorDeDb(error);
}

// ---------------------------------------------------------------------------
// crearCedulario
// ---------------------------------------------------------------------------

/**
 * Creates a cedulario. Any `created_by` in the input is dropped by the schema and
 * the database trigger forces it to the caller (Req 2.4).
 */
export async function crearCedulario(input: CedularioInput): Promise<ActionResult<CedularioRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(cedularioSchema, input);
    if (!datos.ok) return datos;

    const { data, error } = await supabase
      .from('cedularios')
      .insert({
        universidad_id: datos.data.universidad_id,
        nombre: datos.data.nombre,
        version: datos.data.version ?? null,
        descripcion: datos.data.descripcion ?? null,
      })
      .select()
      .single();

    if (error) return fallaDeCedulario(error);
    return actionOk(data);
  });
}

// ---------------------------------------------------------------------------
// editarCedulario
// ---------------------------------------------------------------------------

/**
 * Edits nombre, version and descripcion. `universidad_id` is only updated when it
 * is present in the input; the database guard raises CD007 (`solo_creador_o_admin`)
 * when the user cannot manage the cedulario. A zero-row update is `sin_permisos`.
 */
export async function editarCedulario(
  id: string,
  input: Partial<CedularioInput>,
): Promise<ActionResult<CedularioRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;
    const datos = parsear(cedularioEdicionSchema, input);
    if (!datos.ok) return datos;

    const { universidad_id, nombre, version, descripcion } = datos.data;

    const { data, error } = await supabase
      .from('cedularios')
      .update({
        nombre,
        version: version ?? null,
        descripcion: descripcion ?? null,
        ...(universidad_id !== undefined ? { universidad_id } : {}),
      })
      .eq('id', idValido.data)
      .select()
      .maybeSingle();

    if (error) return fallaDeCedulario(error);
    if (!data) return actionFail('sin_permisos');
    return actionOk(data);
  });
}

// ---------------------------------------------------------------------------
// guardarContenidoCedulario
// ---------------------------------------------------------------------------

/**
 * Saves the normativa or rúbrica document. The document is sanitized on the server
 * (no tables), checked against the size limit, stored, and returned sanitized.
 */
export async function guardarContenidoCedulario(
  id: string,
  campo: CampoContenidoCedulario,
  doc: unknown,
): Promise<ActionResult<TiptapDoc>> {
  let userId: string | null = null;

  return runAction({ accion: 'guardarContenidoCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;
    const campoValido = campoContenidoSchema.safeParse(campo);
    if (!campoValido.success) return actionFail('validacion');

    const sanitizado = sanitizeDoc(doc, 'sin_tablas');
    const validado = parsear(tiptapDocSinTablasSchema, sanitizado, campoValido.data);
    if (!validado.ok) return validado;

    const contenido = validado.data as unknown as Json;
    const cambios = campoValido.data === 'normativa' ? { normativa: contenido } : { rubrica: contenido };

    const { data, error } = await supabase
      .from('cedularios')
      .update(cambios)
      .eq('id', idValido.data)
      .select('id')
      .maybeSingle();

    if (error) return errorDeDb(error);
    if (!data) return actionFail('sin_permisos');
    return actionOk(validado.data);
  });
}

// ---------------------------------------------------------------------------
// eliminarCedulario
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a cedulario.
 * - Assignments block it (`cedulario_con_asignaciones`).
 * - With active materias and `confirmado` not true, nothing is deleted and the
 *   result is `{ eliminado: false, requiereConfirmacion: { materias } }`.
 * - Otherwise `desactivar_cedulario` runs without `.select()`: the SELECT policy
 *   rejects the new inactive row for non-admins, so RETURNING would fail the update.
 */
export async function eliminarCedulario(
  id: string,
  opciones: { confirmado?: boolean } = {},
): Promise<ActionResult<ResultadoEliminarCedulario>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;
    const opcionesValidas = parsear(opcionesEliminarSchema, opciones ?? {});
    if (!opcionesValidas.ok) return opcionesValidas;
    const cedularioId = idValido.data;
    const confirmado = opcionesValidas.data.confirmado === true;

    // Friendly early exit: only the creator or an admin can delete (the DB guard also enforces it).
    const { data: puedeGestionar, error: errorGestion } = await supabase.rpc('cedulario_puede_gestionar', {
      p_id: cedularioId,
    });
    if (errorGestion) return errorDeDb(errorGestion);
    if (!puedeGestionar) return actionFail('sin_permisos');

    const { count, error: errorConteo } = await supabase
      .from('materias')
      .select('id', { count: 'exact', head: true })
      .eq('cedulario_id', cedularioId)
      .eq('activo', true);
    if (errorConteo) return errorDeDb(errorConteo);

    const { data: tieneAsignaciones, error: errorAsignaciones } = await supabase.rpc(
      'cedulario_tiene_asignaciones',
      { p_id: cedularioId },
    );
    if (errorAsignaciones) return errorDeDb(errorAsignaciones);

    const evaluacion = evaluarEliminacionCedulario(count ?? 0, tieneAsignaciones === true);

    if (evaluacion.accion === 'bloqueado') return actionFail('cedulario_con_asignaciones');
    if (evaluacion.accion === 'confirmar' && !confirmado) {
      return actionOk<ResultadoEliminarCedulario>({
        eliminado: false,
        requiereConfirmacion: { materias: evaluacion.materias },
      });
    }

    const { data: desactivado, error } = await supabase.rpc('desactivar_cedulario', { p_id: cedularioId });
    if (error) return errorDeDb(error);
    // false: the cedulario is missing, already inactive, or RLS filtered the update.
    if (!desactivado) return actionFail('sin_permisos');

    return actionOk<ResultadoEliminarCedulario>({ eliminado: true });
  });
}
