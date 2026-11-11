/**
 * Types and pure helpers shared by the assign wizard and its pieces
 * (`AsignarWizard`, `WizardCabecera`, `WizardPie`, `WizardPasos`).
 */

import type { useQueryClient, InfiniteData } from '@tanstack/react-query';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import {
  materiasPorDefecto,
  pasoInicial,
  type EstadoWizard,
  type ModoWizard,
  type ResultadoAsignacionCedulario,
  type SeleccionMaterias,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { AlumnoAsignable } from '@/lib/queries/cedularios/seguimiento/asignables';
import type { ResultadoAsignacionAlumno } from '@/app/actions/cedularios/seguimiento/asignaciones';

export type Bloqueo = 'inactivo' | 'sin_permisos' | 'ya_asignado';

export interface CedularioFijo {
  id: string;
  nombre: string;
}

export type ResultadoVista =
  | { tipo: 'alumnos'; filas: ResultadoAsignacionAlumno[]; nombres: Record<string, string> }
  | { tipo: 'cedularios'; filas: ResultadoAsignacionCedulario[] };

export function nombreCompleto(partes: readonly (string | null | undefined)[]): string {
  return partes
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte !== '')
    .join(' ');
}

/** Names of the selected students, read from the selector pages already in the cache. */
export function nombresDeSeleccionados(
  qc: ReturnType<typeof useQueryClient>,
  cedularioId: string,
  alumnoIds: readonly string[],
): Record<string, string> {
  const buscados = new Set(alumnoIds);
  const nombres: Record<string, string> = {};
  const entradas = qc.getQueriesData<InfiniteData<AlumnoAsignable[]>>({
    queryKey: [...seguimientoKeys.all, 'asignables', cedularioId],
  });
  for (const [, data] of entradas) {
    for (const pagina of data?.pages ?? []) {
      for (const alumno of pagina) {
        if (!buscados.has(alumno.id) || alumno.id in nombres) continue;
        nombres[alumno.id] = nombreCompleto([alumno.nombre, alumno.apellido, alumno.apellidoMaterno]);
      }
    }
  }
  return nombres;
}

export function estadoInicial(
  modo: ModoWizard,
  cedularioFijo: CedularioFijo | null,
  materiasIniciales: SeleccionMaterias,
): EstadoWizard {
  const cedularioIds = modo !== 'alumno' && cedularioFijo ? [cedularioFijo.id] : [];
  const previas: Record<string, SeleccionMaterias> =
    modo === 'reasignar' && cedularioFijo ? { [cedularioFijo.id]: materiasIniciales } : {};
  return {
    paso: pasoInicial(modo),
    cedularioIds,
    alumnoIds: [],
    materias: materiasPorDefecto(cedularioIds, previas),
    indiceMaterias: 0,
  };
}
