'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { obtenerContextoStaff, parsear, parsearId } from '@/lib/cedularios/contexto-accion';
import { toActionError } from '@/lib/cedularios/errors';
import type { Database } from '@/lib/supabase/types';
import { repasoSchema } from '@/lib/validations/cedularioSeguimiento.schema';

type RepasoRow = Database['public']['Tables']['materia_progreso_repasos']['Row'];

const crearRepasoSchema = repasoSchema.extend({
  progresoId: z.guid({ error: 'progreso_invalido' }),
});

/** An empty review note is stored as no note. */
function notaONull(nota: string | undefined): string | null {
  return nota !== undefined && nota.trim().length > 0 ? nota : null;
}

export async function crearRepaso(input: {
  progresoId: string;
  fecha: string;
  nota?: string;
}): Promise<ActionResult<RepasoRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearRepaso', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const parsed = parsear(crearRepasoSchema, input);
    if (!parsed.ok) return parsed;
    const datos = parsed.data;

    // `asignacion_id` and `created_by` are derived and forced by the guard trigger.
    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_repasos')
      .insert({
        progreso_id: datos.progresoId,
        fecha: datos.fecha,
        nota: notaONull(datos.nota),
      })
      .select()
      .single();

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk(data);
  });
}

export async function editarRepaso(input: {
  id: string;
  fecha: string;
  nota?: string;
}): Promise<ActionResult<RepasoRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarRepaso', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const idParsed = parsearId(input?.id);
    if (!idParsed.ok) return idParsed;
    const parsed = parsear(repasoSchema, { fecha: input?.fecha, nota: input?.nota });
    if (!parsed.ok) return parsed;
    const datos = parsed.data;

    // Only fecha and nota change; created_by and created_at stay as they are.
    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_repasos')
      .update({ fecha: datos.fecha, nota: notaONull(datos.nota) })
      .eq('id', idParsed.data)
      .select()
      .maybeSingle();

    if (error) return { ok: false, error: toActionError(error) };
    // Zero rows: RLS filtered the update or the review no longer exists.
    if (!data) return actionFail('sin_permisos');
    return actionOk(data);
  });
}

export async function eliminarRepaso(input: { id: string }): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarRepaso', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const idParsed = parsearId(input?.id);
    if (!idParsed.ok) return idParsed;

    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_repasos')
      .delete()
      .eq('id', idParsed.data)
      .select('id');

    if (error) return { ok: false, error: toActionError(error) };
    // Zero deleted rows: RLS filtered the delete or the review no longer exists.
    if (!data || data.length === 0) return actionFail('sin_permisos');
    return actionOk();
  });
}
