'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { toActionError } from '@/lib/cedularios/errors';
import type { EnlaceScope } from '@/lib/cedularios/keys';
import { enlaceSchema } from '@/lib/cedularios/schemas';
import { zodAActionError } from '@/lib/cedularios/validacion-zod';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type CedularioEnlaceRow = Database['public']['Tables']['cedulario_enlaces']['Row'];
type MateriaEnlaceRow = Database['public']['Tables']['materia_enlaces']['Row'];
type EnlaceRow = CedularioEnlaceRow | MateriaEnlaceRow;

const idSchema = z.guid({ error: 'validacion' });
const idsSchema = z.array(idSchema);
const scopeSchema = z.enum(['cedulario', 'materia']);

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type SesionResultado =
  | { ok: true; supabase: SupabaseServer; userId: string }
  | { ok: false; resultado: ActionResult<never> };

/** Creates the server client and resolves the signed-in user. No session means `sin_permisos`. */
async function abrirSesion(): Promise<SesionResultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (data.user) return { ok: true, supabase, userId: data.user.id };

  if (error?.name === 'AuthRetryableFetchError') {
    return { ok: false, resultado: actionFail('error_conexion') };
  }
  return { ok: false, resultado: actionFail('sin_permisos') };
}

/** An empty description is stored as no description. */
function descripcionONull(descripcion: string | undefined): string | null {
  return descripcion !== undefined && descripcion.trim().length > 0 ? descripcion : null;
}

export async function crearEnlace(input: {
  scope: EnlaceScope;
  parentId: string;
  url: string;
  titulo: string;
  descripcion?: string;
}): Promise<ActionResult<EnlaceRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearEnlace', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const scopeParsed = scopeSchema.safeParse(input?.scope);
    const parentParsed = idSchema.safeParse(input?.parentId);
    if (!scopeParsed.success || !parentParsed.success) return actionFail('validacion');
    const parsed = enlaceSchema.safeParse({
      url: input.url,
      titulo: input.titulo,
      descripcion: input.descripcion,
    });
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error) };
    const datos = parsed.data;
    const parentId = parentParsed.data;

    // `orden = 0` makes the guard trigger append the link.
    if (scopeParsed.data === 'cedulario') {
      const { data, error } = await sesion.supabase
        .from('cedulario_enlaces')
        .insert({
          cedulario_id: parentId,
          url: datos.url,
          titulo: datos.titulo,
          descripcion: descripcionONull(datos.descripcion),
          orden: 0,
        })
        .select()
        .single();

      if (error) return { ok: false, error: toActionError(error) };
      return actionOk<EnlaceRow>(data);
    }

    // The Insert type requires `cedulario_id`. The guard trigger overwrites it with the
    // materia's cedulario, so read the real value first. RLS hides materias the user
    // cannot see, so a missing row means no permission.
    const { data: materia, error: errorMateria } = await sesion.supabase
      .from('materias')
      .select('cedulario_id')
      .eq('id', parentId)
      .maybeSingle();

    if (errorMateria) return { ok: false, error: toActionError(errorMateria) };
    if (!materia) return actionFail('sin_permisos');

    const { data, error } = await sesion.supabase
      .from('materia_enlaces')
      .insert({
        materia_id: parentId,
        cedulario_id: materia.cedulario_id,
        url: datos.url,
        titulo: datos.titulo,
        descripcion: descripcionONull(datos.descripcion),
        orden: 0,
      })
      .select()
      .single();

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk<EnlaceRow>(data);
  });
}

export async function editarEnlace(input: {
  scope: EnlaceScope;
  id: string;
  url: string;
  titulo: string;
  descripcion?: string;
}): Promise<ActionResult<EnlaceRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarEnlace', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const scopeParsed = scopeSchema.safeParse(input?.scope);
    const idParsed = idSchema.safeParse(input?.id);
    if (!scopeParsed.success || !idParsed.success) return actionFail('validacion');
    const parsed = enlaceSchema.safeParse({
      url: input.url,
      titulo: input.titulo,
      descripcion: input.descripcion,
    });
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error) };
    const datos = parsed.data;

    const cambios = {
      url: datos.url,
      titulo: datos.titulo,
      descripcion: descripcionONull(datos.descripcion),
    };

    const { data, error } =
      scopeParsed.data === 'cedulario'
        ? await sesion.supabase
            .from('cedulario_enlaces')
            .update(cambios)
            .eq('id', idParsed.data)
            .select()
            .maybeSingle()
        : await sesion.supabase
            .from('materia_enlaces')
            .update(cambios)
            .eq('id', idParsed.data)
            .select()
            .maybeSingle();

    if (error) return { ok: false, error: toActionError(error) };
    // Zero rows: RLS filtered the update or the enlace no longer exists.
    if (!data) return actionFail('sin_permisos');
    return actionOk<EnlaceRow>(data);
  });
}

export async function eliminarEnlace(input: {
  scope: EnlaceScope;
  id: string;
}): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarEnlace', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const scopeParsed = scopeSchema.safeParse(input?.scope);
    const idParsed = idSchema.safeParse(input?.id);
    if (!scopeParsed.success || !idParsed.success) return actionFail('validacion');

    // Hard delete: the audit trigger keeps a snapshot of the row.
    const { data, error } =
      scopeParsed.data === 'cedulario'
        ? await sesion.supabase.from('cedulario_enlaces').delete().eq('id', idParsed.data).select('id')
        : await sesion.supabase.from('materia_enlaces').delete().eq('id', idParsed.data).select('id');

    if (error) return { ok: false, error: toActionError(error) };
    if (!data || data.length === 0) return actionFail('sin_permisos');
    return actionOk();
  });
}

export async function reordenarEnlaces(input: {
  scope: EnlaceScope;
  parentId: string;
  ids: string[];
}): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'reordenarEnlaces', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const scopeParsed = scopeSchema.safeParse(input?.scope);
    const parentParsed = idSchema.safeParse(input?.parentId);
    const idsParsed = idsSchema.safeParse(input?.ids);
    if (!scopeParsed.success || !parentParsed.success || !idsParsed.success) {
      return actionFail('validacion');
    }

    // A stale or duplicated id set raises CD009 (`lista_desactualizada`); the UI reloads the list.
    const { error } =
      scopeParsed.data === 'cedulario'
        ? await sesion.supabase.rpc('reordenar_enlaces_cedulario', {
            p_cedulario_id: parentParsed.data,
            p_ids: idsParsed.data,
          })
        : await sesion.supabase.rpc('reordenar_enlaces_materia', {
            p_materia_id: parentParsed.data,
            p_ids: idsParsed.data,
          });

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk();
  });
}
