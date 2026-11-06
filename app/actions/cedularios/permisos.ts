'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { errorDeDb, obtenerContextoStaff, parsear } from '@/lib/cedularios/contexto-accion';
import { validarOtorgarPermiso } from '@/lib/cedularios/permisos';
import type { Database } from '@/lib/supabase/types';

type CedularioProfesorRow = Database['public']['Tables']['cedulario_profesores']['Row'];

/** Row returned by `otorgarPermiso`. */
export type PermisoOtorgado = Pick<CedularioProfesorRow, 'id' | 'profesor_id' | 'granted_by' | 'created_at'>;

/** Profesor that can still be added as collaborator. */
export interface ProfesorDisponibleAccion {
  id: string;
  nombre: string;
  apellido: string;
}

const idSchema = z.guid({ error: 'validacion' });

const permisoSchema = z.object({
  cedularioId: idSchema,
  profesorId: idSchema,
});

// ---------------------------------------------------------------------------
// otorgarPermiso
// ---------------------------------------------------------------------------

/**
 * Grants edit permission on a cedulario to a profesor (Req 6.2 to 6.6, 6.11, 6.14).
 *
 * The checks here only give an early, friendly error; the guard trigger (CD005, CD006),
 * the unique index and RLS stay the authority. `granted_by` is never sent: the trigger
 * forces it to `auth.uid()`. The change entry is written by the database trigger in the
 * same statement.
 */
export async function otorgarPermiso(input: {
  cedularioId: string;
  profesorId: string;
}): Promise<ActionResult<PermisoOtorgado>> {
  let userId: string | null = null;

  return runAction({ accion: 'otorgarPermiso', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(permisoSchema, input);
    if (!datos.ok) return datos;
    const { cedularioId, profesorId } = datos.data;

    // Only the creator or an admin manages permisos (Req 6.11), including collaborators.
    const { data: puedeGestionar, error: errorGestion } = await supabase.rpc('cedulario_puede_gestionar', {
      p_id: cedularioId,
    });
    if (errorGestion) return errorDeDb(errorGestion);
    if (!puedeGestionar) return actionFail('sin_permisos');

    const { data: cedulario, error: errorCedulario } = await supabase
      .from('cedularios')
      .select('created_by')
      .eq('id', cedularioId)
      .maybeSingle();
    if (errorCedulario) return errorDeDb(errorCedulario);
    if (!cedulario) return actionFail('sin_permisos');

    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('id, rol')
      .eq('id', profesorId)
      .maybeSingle();
    if (errorPerfil) return errorDeDb(errorPerfil);
    // A profile that cannot be read or does not exist is not a selectable profesor.
    if (!perfil) return actionFail('colaborador_no_profesor');

    const { data: colaboradores, error: errorColaboradores } = await supabase.rpc('listar_colaboradores', {
      p_cedulario_id: cedularioId,
    });
    if (errorColaboradores) return errorDeDb(errorColaboradores);

    const validacion = validarOtorgarPermiso({
      cedulario: { createdBy: cedulario.created_by },
      profesor: { id: perfil.id, rol: perfil.rol },
      existentes: new Set((colaboradores ?? []).map((fila) => fila.id)),
    });
    if (!validacion.ok) {
      switch (validacion.razon) {
        case 'no_es_profesor':
          return actionFail('colaborador_no_profesor');
        case 'es_creador':
          return actionFail('colaborador_es_creador');
        case 'duplicado':
          return actionFail('permiso_duplicado');
      }
    }

    // RLS rejection (42501) maps to `sin_permisos`; CD005/CD006/unique violation map to their codes.
    const { data, error } = await supabase
      .from('cedulario_profesores')
      .insert({ cedulario_id: cedularioId, profesor_id: profesorId })
      .select('id, profesor_id, granted_by, created_at')
      .single();

    if (error) return errorDeDb(error);
    return actionOk<PermisoOtorgado>(data);
  });
}

// ---------------------------------------------------------------------------
// revocarPermiso
// ---------------------------------------------------------------------------

/**
 * Revokes a permission (hard delete, Req 6.7 and 6.8). Zero deleted rows means RLS
 * filtered the delete (not creator or admin, including a collaborator removing
 * himself) or the permission no longer exists, reported as `sin_permisos` (Req 6.11).
 */
export async function revocarPermiso(input: {
  cedularioId: string;
  profesorId: string;
}): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'revocarPermiso', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(permisoSchema, input);
    if (!datos.ok) return datos;

    const { data, error } = await supabase
      .from('cedulario_profesores')
      .delete()
      .eq('cedulario_id', datos.data.cedularioId)
      .eq('profesor_id', datos.data.profesorId)
      .select('id');

    if (error) return errorDeDb(error);
    if (!data || data.length === 0) return actionFail('sin_permisos');
    return actionOk();
  });
}

// ---------------------------------------------------------------------------
// listarProfesoresDisponibles
// ---------------------------------------------------------------------------

/**
 * Profesores that can still be added to a cedulario: every profesor except the
 * creator and the current collaborators.
 */
export async function listarProfesoresDisponibles(
  cedularioId: string,
): Promise<ActionResult<ProfesorDisponibleAccion[]>> {
  let userId: string | null = null;

  return runAction({ accion: 'listarProfesoresDisponibles', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsear(idSchema, cedularioId, 'cedularioId');
    if (!idValido.ok) return idValido;

    const { data: cedulario, error: errorCedulario } = await supabase
      .from('cedularios')
      .select('created_by')
      .eq('id', idValido.data)
      .maybeSingle();
    if (errorCedulario) return errorDeDb(errorCedulario);
    if (!cedulario) return actionFail('sin_permisos');

    const { data: profesores, error: errorProfesores } = await supabase.rpc('listar_profesores_cedularios');
    if (errorProfesores) return errorDeDb(errorProfesores);

    const { data: colaboradores, error: errorColaboradores } = await supabase.rpc('listar_colaboradores', {
      p_cedulario_id: idValido.data,
    });
    if (errorColaboradores) return errorDeDb(errorColaboradores);

    const excluidos = new Set((colaboradores ?? []).map((fila) => fila.id));
    if (cedulario.created_by) excluidos.add(cedulario.created_by);

    return actionOk<ProfesorDisponibleAccion[]>(
      (profesores ?? [])
        .filter((fila) => !excluidos.has(fila.id))
        .map((fila) => ({ id: fila.id, nombre: fila.nombre, apellido: fila.apellido })),
    );
  });
}
