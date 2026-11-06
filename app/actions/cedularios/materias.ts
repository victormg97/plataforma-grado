'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { toActionError } from '@/lib/cedularios/errors';
import { sanitizeDoc, type TiptapDoc } from '@/lib/cedularios/richtext';
import { materiaSchema, tiptapDocSchema } from '@/lib/cedularios/schemas';
import { zodAActionError } from '@/lib/cedularios/validacion-zod';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/supabase/types';

type MateriaRow = Database['public']['Tables']['materias']['Row'];

const MAX_BUSQUEDA_CARACTERES = 100;

const idSchema = z.guid({ error: 'validacion' });
const idOpcionalSchema = idSchema.nullish();

const materiaEdicionSchema = materiaSchema.omit({ parent_id: true });

const crearMateriaSchema = materiaSchema.extend({ cedulario_id: idSchema });

const moverMateriaSchema = z.object({
  id: idSchema,
  nuevoParentId: idOpcionalSchema,
  despuesDeId: idOpcionalSchema,
});

const idsSchema = z.array(idSchema);

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

/** Insert and update payloads treat an empty description as no description. */
function descripcionONull(descripcion: string | undefined): string | null {
  return descripcion !== undefined && descripcion.trim().length > 0 ? descripcion : null;
}

export async function crearMateria(input: {
  cedulario_id: string;
  parent_id: string | null;
  codigo: string;
  nombre: string;
  descripcion?: string;
}): Promise<ActionResult<MateriaRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearMateria', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const parsed = crearMateriaSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error) };
    const datos = parsed.data;

    // `orden = 0` makes the guard trigger append the row; `nivel` is derived by the trigger.
    const { data, error } = await sesion.supabase
      .from('materias')
      .insert({
        cedulario_id: datos.cedulario_id,
        parent_id: datos.parent_id,
        codigo: datos.codigo,
        nombre: datos.nombre,
        descripcion: descripcionONull(datos.descripcion),
        orden: 0,
      })
      .select()
      .single();

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk(data);
  });
}

export async function editarMateria(
  id: string,
  input: { codigo: string; nombre: string; descripcion?: string },
): Promise<ActionResult<MateriaRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarMateria', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const idParsed = idSchema.safeParse(id);
    if (!idParsed.success) return actionFail('validacion');
    const parsed = materiaEdicionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error) };
    const datos = parsed.data;

    const { data, error } = await sesion.supabase
      .from('materias')
      .update({
        codigo: datos.codigo,
        nombre: datos.nombre,
        descripcion: descripcionONull(datos.descripcion),
      })
      .eq('id', idParsed.data)
      .select()
      .maybeSingle();

    if (error) return { ok: false, error: toActionError(error) };
    // Zero rows: RLS filtered the update or the materia no longer exists.
    if (!data) return actionFail('sin_permisos');
    return actionOk(data);
  });
}

export async function guardarTemario(id: string, doc: unknown): Promise<ActionResult<TiptapDoc>> {
  let userId: string | null = null;

  return runAction({ accion: 'guardarTemario', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const idParsed = idSchema.safeParse(id);
    if (!idParsed.success) return actionFail('validacion');

    // Never trust the client: strip anything outside the allow-list, then check the size.
    const sanitizado = sanitizeDoc(doc, 'con_tablas');
    const parsed = tiptapDocSchema.safeParse(sanitizado);
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error, 'temario') };

    const { data, error } = await sesion.supabase
      .from('materias')
      .update({ temario: sanitizado as unknown as Json })
      .eq('id', idParsed.data)
      .select('id')
      .maybeSingle();

    if (error) return { ok: false, error: toActionError(error) };
    if (!data) return actionFail('sin_permisos');
    return actionOk(sanitizado);
  });
}

export async function moverMateria(input: {
  id: string;
  nuevoParentId: string | null;
  despuesDeId: string | null;
}): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'moverMateria', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const parsed = moverMateriaSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodAActionError(parsed.error) };
    const datos = parsed.data;

    const { error } = await sesion.supabase.rpc('mover_materia', {
      p_id: datos.id,
      p_nuevo_parent: datos.nuevoParentId ?? null,
      p_despues_de: datos.despuesDeId ?? null,
    });

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk();
  });
}

export async function eliminarMateria(id: string): Promise<ActionResult<{ ids: string[] }>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarMateria', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const idParsed = idSchema.safeParse(id);
    if (!idParsed.success) return actionFail('validacion');

    const { data, error } = await sesion.supabase.rpc('desactivar_materia', { p_id: idParsed.data });

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk({ ids: data ?? [] });
  });
}

export async function restaurarMaterias(ids: string[]): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'restaurarMaterias', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const parsed = idsSchema.safeParse(ids);
    if (!parsed.success) return actionFail('validacion');
    const unicos = Array.from(new Set(parsed.data));
    if (unicos.length === 0) return actionOk();

    // A unique violation (codigo taken by a new sibling) maps to `codigo_duplicado_nivel`.
    const { error } = await sesion.supabase.rpc('restaurar_materias', { p_ids: unicos });

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk();
  });
}

export async function buscarMateriasTemario(cedularioId: string, q: string): Promise<ActionResult<string[]>> {
  let userId: string | null = null;

  return runAction({ accion: 'buscarMateriasTemario', userId: () => userId }, async () => {
    const sesion = await abrirSesion();
    if (!sesion.ok) return sesion.resultado;
    userId = sesion.userId;

    const idParsed = idSchema.safeParse(cedularioId);
    if (!idParsed.success) return actionFail('validacion');

    const texto = typeof q === 'string' ? q.trim() : '';
    if (texto.length === 0) return actionOk<string[]>([]);
    const recortado = Array.from(texto).slice(0, MAX_BUSQUEDA_CARACTERES).join('');

    const { data, error } = await sesion.supabase.rpc('buscar_materias', {
      p_cedulario_id: idParsed.data,
      p_q: recortado,
    });

    if (error) return { ok: false, error: toActionError(error) };
    return actionOk((data ?? []).map((fila) => fila.id));
  });
}
