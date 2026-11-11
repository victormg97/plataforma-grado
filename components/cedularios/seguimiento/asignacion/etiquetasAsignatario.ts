import { esStaffAsignatario } from '@/lib/cedularios/seguimiento/asignatario';

/** i18n keys (namespace `cedularios.seguimiento`) of the fixed assignee of the wizard. */
export interface EtiquetasAsignatario {
  /** Label above the fixed assignee block. */
  fijo: string;
  /** Header description of the wizard in "alumno" mode. */
  descripcion: string;
}

/** Picks neutral wording ("Persona") when the assignee is a profesor or administrador. */
export function etiquetasAsignatario(rol: string | null | undefined): EtiquetasAsignatario {
  return esStaffAsignatario(rol)
    ? { fijo: 'asignar.alumnos.persona_fija', descripcion: 'asignar.descripcion_persona' }
    : { fijo: 'asignar.alumnos.alumno_fijo', descripcion: 'asignar.descripcion_alumno' };
}
