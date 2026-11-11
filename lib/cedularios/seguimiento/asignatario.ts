/**
 * Assignee roles of the tracking: besides alumnos, profesores and administradores can be
 * assigned cedularios to track their own study. Pure module: no React, no Supabase.
 */

export type AsignatarioRol = 'alumno' | 'profesor' | 'admin';

/** Normalizes a raw role from the server; anything unknown falls back to `alumno`. */
export function normalizarAsignatarioRol(rol: string | null | undefined): AsignatarioRol {
  return rol === 'profesor' || rol === 'admin' ? rol : 'alumno';
}

/** True when the assignee is a profesor or an administrador (not an alumno). */
export function esStaffAsignatario(rol: string | null | undefined): boolean {
  return normalizarAsignatarioRol(rol) !== 'alumno';
}

/**
 * Own-cedularios action: "asignar" when the user has no active assignment, "revisar" otherwise.
 * Negative, NaN or non-finite counts count as zero.
 */
export function accionCedularioPropio(totalActivas: number): 'asignar' | 'revisar' {
  return Number.isFinite(totalActivas) && totalActivas > 0 ? 'revisar' : 'asignar';
}
