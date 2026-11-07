'use server';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { obtenerContextoStaff, parsear, parsearId } from '@/lib/cedularios/contexto-accion';
import { toActionError } from '@/lib/cedularios/errors';
import type { Database } from '@/lib/supabase/types';
import { comentarioSchema } from '@/lib/validations/cedularioSeguimiento.schema';

type ComentarioRow = Database['public']['Tables']['materia_progreso_comentarios']['Row'];

const CAMPO_TEXTO = 'texto';

export async function crearComentario(input: {
  progresoId: string;
  texto: string;
}): Promise<ActionResult<ComentarioRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearComentario', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const progresoParsed = parsearId(input?.progresoId);
    if (!progresoParsed.ok) return progresoParsed;
    const textoParsed = parsear(comentarioSchema, input?.texto, CAMPO_TEXTO);
    if (!textoParsed.ok) return textoParsed;

    // The author and `asignacion_id` are set by the guard trigger; any client value is ignored.
    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_comentarios')
      .insert({ progreso_id: progresoParsed.data, texto: textoParsed.data })
      .select()
      .single();

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk(data);
  });
}

export async function editarComentario(input: {
  id: string;
  texto: string;
}): Promise<ActionResult<ComentarioRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarComentario', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const idParsed = parsearId(input?.id);
    if (!idParsed.ok) return idParsed;
    const textoParsed = parsear(comentarioSchema, input?.texto, CAMPO_TEXTO);
    if (!textoParsed.ok) return textoParsed;

    // Only the author or an admin passes the guard trigger (42501); it also sets `edited_at`.
    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_comentarios')
      .update({ texto: textoParsed.data })
      .eq('id', idParsed.data)
      .select()
      .maybeSingle();

    if (error) return { ok: false, error: toActionError(error) };
    // Zero rows: RLS filtered the update or the comment no longer exists.
    if (!data) return actionFail('sin_permisos');
    return actionOk(data);
  });
}

export async function eliminarComentario(input: { id: string }): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarComentario', userId: () => userId }, async () => {
    const ctx = await obtenerContextoStaff();
    if (!ctx.ok) return ctx;
    userId = ctx.data.userId;

    const idParsed = parsearId(input?.id);
    if (!idParsed.ok) return idParsed;

    const { data, error } = await ctx.data.supabase
      .from('materia_progreso_comentarios')
      .delete()
      .eq('id', idParsed.data)
      .select('id');

    if (error) return { ok: false, error: toActionError(error) };
    // Zero deleted rows: RLS (author or admin only) filtered the delete, or the comment is gone.
    if (!data || data.length === 0) return actionFail('sin_permisos');
    return actionOk();
  });
}
