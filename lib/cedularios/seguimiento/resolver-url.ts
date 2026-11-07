/**
 * Resolves an inconsistent `seg_*` URL state into a patch that fixes it.
 * Pure module: no React, no Supabase.
 *
 * Dependency rules:
 * - invalid student            -> remove every seg_* param
 * - cedulario without a visible assignment -> remove cedulario, materia and modal
 * - materia not assigned in the assignment -> remove only materia
 *
 * The returned patch only holds params that must change, so an empty object
 * means the state is already consistent. It is meant for `aplicarSegPatch`.
 */

import type { SegState } from './url';

export interface DatosValidacionSeg {
  /** The student exists, has the student role and is visible to the user. */
  alumnoVisible: boolean;
  /** The user sees an assignment (active or not) of `estado.cedulario` for the student. */
  cedularioAsignado: boolean;
  /** `estado.materia` is an assigned materia of that assignment. */
  materiaAsignada: boolean;
}

/** Modals that cannot work without a student. */
const MODALES_CON_ALUMNO = new Set<SegState['modal']>(['revision', 'editar_materias']);

export function resolverSegInvalido(
  estado: SegState,
  datos: DatosValidacionSeg,
): Partial<SegState> {
  const alumnoInvalido =
    estado.alumno !== null
      ? !datos.alumnoVisible
      : estado.modal !== null && MODALES_CON_ALUMNO.has(estado.modal);

  if (alumnoInvalido) {
    const parche: Partial<SegState> = {};
    if (estado.modal !== null) parche.modal = null;
    if (estado.alumno !== null) parche.alumno = null;
    if (estado.cedulario !== null) parche.cedulario = null;
    if (estado.materia !== null) parche.materia = null;
    if (estado.filtro !== 'todas') parche.filtro = 'todas';
    if (estado.q !== '') parche.q = '';
    return parche;
  }

  // Without a student only the assign dialog can be open, and there is no
  // assignment to check.
  if (estado.alumno === null) return {};

  const parche: Partial<SegState> = {};

  const cedularioInvalido =
    (estado.cedulario !== null && !datos.cedularioAsignado) ||
    // The edit view needs a cedulario.
    (estado.modal === 'editar_materias' && estado.cedulario === null);

  if (cedularioInvalido) {
    if (estado.cedulario !== null) parche.cedulario = null;
    if (estado.materia !== null) parche.materia = null;
    if (estado.modal !== null) parche.modal = null;
    return parche;
  }

  if (estado.materia !== null && !datos.materiaAsignada) parche.materia = null;

  return parche;
}
