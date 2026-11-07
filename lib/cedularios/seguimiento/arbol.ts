/**
 * Classification of the materias shown in the tracking tree of one assignment.
 * Pure module: no React, no Supabase.
 *
 * An active materia is 'asignada' when its progress row has asignada = true, 'contexto' when it
 * is not assigned but is an ancestor of at least one assigned materia, and it is omitted
 * otherwise. Context materias have no progress row and never count in any aggregate.
 */

import type { MateriaNodo } from '../tree';
import type { ProgresoFila, RolMateria } from './tipos';

/**
 * Role of every active materia of `flat` that belongs to the tree of the assignment.
 * Inactive materias, archived rows and unrelated materias have no entry.
 * Ancestors are found through `parentId`, so the result stays correct after moving materias.
 */
export function clasificarMaterias(
  flat: MateriaNodo[],
  progreso: ProgresoFila[],
): Map<string, RolMateria> {
  const porId = new Map<string, MateriaNodo>();
  for (const nodo of flat) porId.set(nodo.id, nodo);

  const roles = new Map<string, RolMateria>();
  for (const fila of progreso) {
    if (!fila.asignada) continue;
    const materia = porId.get(fila.materiaId);
    if (materia && materia.activo) roles.set(materia.id, 'asignada');
  }

  const asignadas = Array.from(roles.keys());
  for (const id of asignadas) {
    const visitados = new Set<string>([id]);
    let actual = porId.get(id);
    while (actual && actual.parentId !== null && !visitados.has(actual.parentId)) {
      const padre = porId.get(actual.parentId);
      if (!padre) break;
      visitados.add(padre.id);
      if (padre.activo && !roles.has(padre.id)) roles.set(padre.id, 'contexto');
      actual = padre;
    }
  }
  return roles;
}

/**
 * The materias of `flat` that have a role, in the original order.
 * The result can be given to `aplanarVisibles` of the phase 1 tree.
 */
export function nodosVisibles(
  flat: MateriaNodo[],
  roles: Map<string, RolMateria>,
): MateriaNodo[] {
  return flat.filter((nodo) => nodo.activo && roles.has(nodo.id));
}
