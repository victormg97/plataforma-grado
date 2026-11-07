/**
 * UI-side permission rules of the tracking (the database stays the authority).
 * Pure module: no React, no Supabase client.
 */

import type { UserRol } from '@/lib/supabase/types';

/**
 * Whether the user can write the tracking of a student: an admin always,
 * a professor only when the student is their own (Alumno_Propio).
 * `userId` is part of the context for symmetry with the other rules but does not
 * change the result: ownership is resolved by the database (`esAlumnoPropio`).
 */
export function puedeGestionarSeguimiento(ctx: {
  rol: UserRol;
  userId: string;
  esAlumnoPropio: boolean;
}): boolean {
  if (ctx.rol === 'admin') return true;
  return ctx.rol === 'profesor' && ctx.esAlumnoPropio;
}

export type ModoRevisor = 'edicion' | 'lectura';

/**
 * Mode of the reviewer: edit only for staff the server allows to write
 * (`puedeEditar`) on an active assignment. Anything else is read only.
 */
export function modoRevisor(ctx: {
  rol: UserRol;
  puedeEditar: boolean;
  asignacionActiva: boolean;
}): ModoRevisor {
  const esStaff = ctx.rol === 'admin' || ctx.rol === 'profesor';
  return esStaff && ctx.puedeEditar && ctx.asignacionActiva ? 'edicion' : 'lectura';
}

/** A comment can be edited or deleted by its author or by an admin. */
export function puedeEditarComentario(ctx: {
  rol: UserRol;
  userId: string;
  autorId: string | null;
}): boolean {
  if (ctx.rol === 'admin') return true;
  return ctx.rol === 'profesor' && ctx.autorId !== null && ctx.autorId === ctx.userId;
}

/** Which actions the student hover card offers. */
export type AccionesHoverCard = {
  irAPerfil: true;
  asignar: boolean;
  revisar: 'ninguno' | 'directo' | 'menu';
  mensajeSinCedularios: boolean;
  etiquetaInactivo: boolean;
};

/**
 * Actions of the hover card (decision D-S20): "assign" only when the student has
 * no active assignment, the user can edit and the student is active. Being admin
 * does not relax the rule because the database rejects assigning inactive students.
 */
export function accionesHoverCard(r: {
  totalActivas: number;
  puedeEditar: boolean;
  alumnoActivo: boolean;
}): AccionesHoverCard {
  const sinAsignaciones = r.totalActivas <= 0;
  let revisar: AccionesHoverCard['revisar'] = 'ninguno';
  if (r.totalActivas === 1) revisar = 'directo';
  else if (r.totalActivas > 1) revisar = 'menu';

  return {
    irAPerfil: true,
    asignar: sinAsignaciones && r.puedeEditar && r.alumnoActivo,
    revisar,
    mensajeSinCedularios: sinAsignaciones && !r.puedeEditar,
    etiquetaInactivo: !r.alumnoActivo,
  };
}

/** The hover card is live only for admin and professor; unknown roles stay inert. */
export const hoverCardActivo = (rol: UserRol | null): boolean =>
  rol === 'admin' || rol === 'profesor';
