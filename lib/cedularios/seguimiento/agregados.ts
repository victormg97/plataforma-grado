/**
 * Branch and global aggregates of the tracking.
 * Pure module: no React, no Supabase.
 *
 * Only assigned materias count: a progress row with asignada = true whose materia is active
 * and present in the tree. Archived rows, context materias, inactive materias and
 * unassigned assignments never enter the numerator or the denominator.
 */

import type { MateriaNodo } from '../tree';
import type { ProgresoFila } from './tipos';

/** Assigned materias (`total`) and how many of them are covered (`cubiertas`). */
export interface Agregado {
  total: number;
  cubiertas: number;
}

/** Ids from `id` up to the root, in that order. Guards against cycles and unknown ids. */
function cadenaHaciaRaiz(porId: Map<string, MateriaNodo>, id: string): string[] {
  const cadena: string[] = [];
  const visitados = new Set<string>();
  let actual: MateriaNodo | undefined = porId.get(id);
  while (actual && !visitados.has(actual.id)) {
    visitados.add(actual.id);
    cadena.push(actual.id);
    actual = actual.parentId === null ? undefined : porId.get(actual.parentId);
  }
  return cadena;
}

/**
 * Aggregate of every active materia: the materia itself plus all its descendants.
 * Every active materia of `flat` has an entry, with total 0 when nothing is assigned under it.
 */
export function construirAgregados(flat: MateriaNodo[], progreso: ProgresoFila[]): Map<string, Agregado> {
  const porId = new Map<string, MateriaNodo>();
  const agregados = new Map<string, Agregado>();
  for (const nodo of flat) {
    porId.set(nodo.id, nodo);
    if (nodo.activo) agregados.set(nodo.id, { total: 0, cubiertas: 0 });
  }

  for (const fila of progreso) {
    if (!fila.asignada) continue;
    const materia = porId.get(fila.materiaId);
    if (!materia || !materia.activo) continue;
    const cubierta = fila.estado === 'cubierta';
    for (const id of cadenaHaciaRaiz(porId, fila.materiaId)) {
      const entrada = agregados.get(id);
      if (!entrada) continue;
      entrada.total += 1;
      if (cubierta) entrada.cubiertas += 1;
    }
  }
  return agregados;
}

/**
 * Applies a coverage change of one assigned materia: `delta` is +1 for pending to covered
 * and -1 for covered to pending. Only the materia and its ancestors change.
 * Returns a new map; `prev` is not mutated.
 */
export function actualizarAgregados(
  prev: Map<string, Agregado>,
  flat: MateriaNodo[],
  materiaId: string,
  delta: -1 | 0 | 1,
): Map<string, Agregado> {
  if (delta === 0) return prev;
  const porId = new Map<string, MateriaNodo>();
  for (const nodo of flat) porId.set(nodo.id, nodo);

  const siguiente = new Map(prev);
  for (const id of cadenaHaciaRaiz(porId, materiaId)) {
    const entrada = siguiente.get(id);
    if (!entrada) continue;
    const cubiertas = Math.min(entrada.total, Math.max(0, entrada.cubiertas + delta));
    siguiente.set(id, { total: entrada.total, cubiertas });
  }
  return siguiente;
}

/** Aggregate of the whole assignment: the sum over the active root materias. */
export function agregadoGlobal(agregados: Map<string, Agregado>, flat: MateriaNodo[]): Agregado {
  let total = 0;
  let cubiertas = 0;
  for (const nodo of flat) {
    if (!nodo.activo || nodo.parentId !== null) continue;
    const entrada = agregados.get(nodo.id);
    if (!entrada) continue;
    total += entrada.total;
    cubiertas += entrada.cubiertas;
  }
  return { total, cubiertas };
}

/**
 * Aggregate of a student: sums assigned and covered materias of the active assignments.
 * It never averages the percentages of each cedulario.
 */
export function agregadoAlumno(
  asignaciones: ReadonlyArray<{
    estado: 'activa' | 'desasignada';
    totalAsignadas: number;
    totalCubiertas: number;
  }>,
): Agregado {
  let total = 0;
  let cubiertas = 0;
  for (const asignacion of asignaciones) {
    if (asignacion.estado !== 'activa') continue;
    total += asignacion.totalAsignadas;
    cubiertas += asignacion.totalCubiertas;
  }
  return { total, cubiertas };
}
