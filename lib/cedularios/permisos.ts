/**
 * Permission rules for cedularios (Property 12).
 *
 * Pure TypeScript, no React and no Supabase. These evaluators mirror the RLS policies and
 * the guard trigger; the database stays the source of truth, this module only drives the UI
 * and lets Server Actions fail early.
 *
 * - Edit (content, materias, temario, links): admin, or profesor who is creator or collaborator.
 * - Manage (soft-delete, grant/revoke permisos, change universidad): admin, or profesor creator.
 * - History: admin or profesor.
 * - alumno and lector never edit or manage.
 */

import type { UserRol } from '@/lib/supabase/types';

export interface ContextoPermiso {
  rol: UserRol;
  userId: string;
  /** `created_by` of the cedulario; null when the creator account no longer exists. */
  creadorId: string | null;
  /** Profesores with an explicit edit permission on the cedulario. */
  colaboradorIds: ReadonlySet<string>;
}

export type RazonPermisoInvalido = 'no_es_profesor' | 'es_creador' | 'duplicado';

export type ResultadoOtorgarPermiso = { ok: true } | { ok: false; razon: RazonPermisoInvalido };

function esCreador(ctx: ContextoPermiso): boolean {
  return ctx.creadorId !== null && ctx.creadorId === ctx.userId;
}

export const puedeVerHistorial = (rol: UserRol): boolean => rol === 'admin' || rol === 'profesor';

export function puedeEditarCedulario(ctx: ContextoPermiso): boolean {
  if (ctx.rol === 'admin') return true;
  if (ctx.rol !== 'profesor') return false;
  return esCreador(ctx) || ctx.colaboradorIds.has(ctx.userId);
}

/** Soft-delete, grant/revoke permisos and universidad changes. Collaborators never manage. */
export function puedeGestionarCedulario(ctx: ContextoPermiso): boolean {
  if (ctx.rol === 'admin') return true;
  return ctx.rol === 'profesor' && esCreador(ctx);
}

export function validarOtorgarPermiso(input: {
  cedulario: { createdBy: string | null };
  profesor: { id: string; rol: UserRol };
  existentes: ReadonlySet<string>;
}): ResultadoOtorgarPermiso {
  const { cedulario, profesor, existentes } = input;
  if (profesor.rol !== 'profesor') return { ok: false, razon: 'no_es_profesor' };
  if (cedulario.createdBy !== null && cedulario.createdBy === profesor.id) {
    return { ok: false, razon: 'es_creador' };
  }
  if (existentes.has(profesor.id)) return { ok: false, razon: 'duplicado' };
  return { ok: true };
}
