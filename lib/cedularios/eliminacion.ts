/**
 * Deletion evaluators (Property 16).
 *
 * Pure TypeScript. Deletions are soft deletes; these functions only decide what the UI and
 * the Server Action should do before `activo` is set to false.
 */

export type ResultadoEliminacionUniversidad =
  | { permitido: true }
  | { permitido: false; razon: 'tiene_cedularios'; cantidad: number };

export type ResultadoEliminacionCedulario =
  | { accion: 'eliminar' }
  | { accion: 'confirmar'; materias: number }
  | { accion: 'bloqueado'; razon: 'tiene_asignaciones' };

/** A universidad can be deleted only when it has no active cedularios. */
export function evaluarEliminacionUniversidad(cedularioActivos: number): ResultadoEliminacionUniversidad {
  if (cedularioActivos > 0) {
    return { permitido: false, razon: 'tiene_cedularios', cantidad: cedularioActivos };
  }
  return { permitido: true };
}

/**
 * - Assignments block the deletion.
 * - No active materias: delete directly, without a dialog.
 * - Otherwise: ask for confirmation, showing the number of active materias.
 */
export function evaluarEliminacionCedulario(
  materiasActivas: number,
  tieneAsignaciones: boolean,
): ResultadoEliminacionCedulario {
  if (tieneAsignaciones) return { accion: 'bloqueado', razon: 'tiene_asignaciones' };
  if (materiasActivas <= 0) return { accion: 'eliminar' };
  return { accion: 'confirmar', materias: materiasActivas };
}
