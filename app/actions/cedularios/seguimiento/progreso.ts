'use server';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { errorDeDb, obtenerContextoStaff, parsear, parsearId } from '@/lib/cedularios/contexto-accion';
import {
  estadoMateriaSchema,
  estadosMateriasSchema,
  notaSchema,
} from '@/lib/validations/cedularioSeguimiento.schema';

/** Result of `establecerEstadoMateria`: the stored coverage and whether the call changed anything. */
export interface ResultadoEstadoMateria {
  estado: 'pendiente' | 'cubierta';
  fechaCubierta: string | null;
  cambio: boolean;
}

/** Result of `guardarNotaMateria`: the stored note (`null` when empty) and its update time. */
export interface ResultadoNotaMateria {
  nota: string | null;
  updatedAt: string;
}

/**
 * Sets the desired coverage of a subject for a student (RPC `establecer_estado_materia`).
 * The RPC is idempotent: repeating the same target returns `cambio = false`.
 * Never logs note or comment text.
 */
export async function establecerEstadoMateria(input: {
  progresoId: string;
  estado: 'pendiente' | 'cubierta';
  fecha?: string;
}): Promise<ActionResult<ResultadoEstadoMateria>> {
  let userId: string | null = null;

  return runAction({ accion: 'establecerEstadoMateria', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const parsed = parsear(estadoMateriaSchema, input);
    if (!parsed.ok) return parsed;
    const datos = parsed.data;

    const { data, error } = await supabase.rpc('establecer_estado_materia', {
      p_progreso_id: datos.progresoId,
      p_estado: datos.estado,
      p_fecha: datos.fecha ?? null,
    });

    if (error) return errorDeDb(error);

    // The RPC raises 42501 when the row is missing or hidden, so an empty result is unexpected.
    const fila = data?.[0];
    if (!fila) return actionFail('sin_permisos');

    return actionOk<ResultadoEstadoMateria>({
      estado: fila.estado === 'cubierta' ? 'cubierta' : 'pendiente',
      fechaCubierta: fila.fecha_cubierta,
      cambio: fila.cambio,
    });
  });
}

/** Result of `establecerEstadosMaterias`: how many progress rows actually changed. */
export interface ResultadoEstadosMaterias {
  cambiadas: number;
}

/**
 * Sets the coverage of several subjects of one assignment in one transaction (RPC
 * `establecer_estado_materias`, migration 156): the parent / child cascade of the reviewer.
 * Idempotent per row; the audit trigger writes one activity entry per changed row and column.
 */
export async function establecerEstadosMaterias(input: {
  asignacionId: string;
  cubiertas: string[];
  pendientes: string[];
}): Promise<ActionResult<ResultadoEstadosMaterias>> {
  let userId: string | null = null;

  return runAction({ accion: 'establecerEstadosMaterias', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const parsed = parsear(estadosMateriasSchema, input);
    if (!parsed.ok) return parsed;
    const datos = parsed.data;

    const { data, error } = await supabase.rpc('establecer_estado_materias', {
      p_asignacion_id: datos.asignacionId,
      p_cubiertas: datos.cubiertas,
      p_pendientes: datos.pendientes,
    });

    if (error) return errorDeDb(error);

    return actionOk<ResultadoEstadosMaterias>({ cambiadas: data ?? 0 });
  });
}

/**
 * Saves the free-text note of a subject. An empty or whitespace-only note is stored as `null`.
 * The last write wins. Zero affected rows means RLS filtered the update or the row is gone.
 * Never logs note text.
 */
export async function guardarNotaMateria(input: {
  progresoId: string;
  nota: string;
}): Promise<ActionResult<ResultadoNotaMateria>> {
  let userId: string | null = null;

  return runAction({ accion: 'guardarNotaMateria', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idParsed = parsearId(input?.progresoId);
    if (!idParsed.ok) return idParsed;
    const notaParsed = parsear(notaSchema, input?.nota, 'nota');
    if (!notaParsed.ok) return notaParsed;

    const { data, error } = await supabase
      .from('materia_progreso')
      .update({ notas: notaParsed.data })
      .eq('id', idParsed.data)
      .select('notas, updated_at')
      .maybeSingle();

    if (error) return errorDeDb(error);
    // Zero rows: RLS filtered the update or the progress row no longer exists.
    if (!data) return actionFail('sin_permisos');

    return actionOk<ResultadoNotaMateria>({ nota: data.notas, updatedAt: data.updated_at });
  });
}
