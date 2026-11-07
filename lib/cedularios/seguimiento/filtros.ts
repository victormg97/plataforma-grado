/**
 * Filter and search of the tracking tree.
 * Pure module: no React, no Supabase.
 *
 * The filter and the search combine: an assigned materia is a result only when it meets both.
 * Results are shown together with all their ancestors, which are also expanded.
 * Aggregates and percentages are never computed from these results.
 */

import { buscarEnArbol } from '../busqueda';
import type { MateriaNodo } from '../tree';
import type { ProgresoFila, RolMateria } from './tipos';

export type SegFiltro = 'todas' | 'pendientes' | 'cubiertas' | 'repasadas';

/** A materia is "repasada" when it has at least one review. */
export const esRepasada = (fila: Pick<ProgresoFila, 'repasos'>): boolean => fila.repasos > 0;

function cumpleFiltro(fila: ProgresoFila, filtro: SegFiltro): boolean {
  switch (filtro) {
    case 'pendientes':
      return fila.estado === 'pendiente';
    case 'cubiertas':
      return fila.estado === 'cubierta';
    case 'repasadas':
      return esRepasada(fila);
    default:
      return true;
  }
}

export interface ResultadoFiltro {
  /** Ids to render: the results plus all their ancestors (every role-bearing materia when no filter or search is active). */
  visibles: Set<string>;
  /** Ancestors of the results to expand. Empty when there is no filter and no search. */
  expandir: Set<string>;
  /** Assigned materias matching the search text. Empty when the trimmed query is empty. */
  coincidencias: Set<string>;
  /** Number of assigned materias that meet both the filter and the search. */
  total: number;
}

/**
 * Applies the filter and the search over the assigned materias of the assignment.
 * An empty or whitespace-only query produces no matches and does not restrict the results.
 */
export function aplicarFiltroYBusqueda(args: {
  flat: MateriaNodo[];
  progreso: ProgresoFila[];
  roles: Map<string, RolMateria>;
  filtro: SegFiltro;
  q: string;
}): ResultadoFiltro {
  const { flat, progreso, roles, filtro, q } = args;
  const hayBusqueda = q.trim() !== '';
  const hayRestriccion = hayBusqueda || filtro !== 'todas';

  const porId = new Map<string, MateriaNodo>();
  for (const nodo of flat) porId.set(nodo.id, nodo);

  const filaPorMateria = new Map<string, ProgresoFila>();
  for (const fila of progreso) {
    if (fila.asignada) filaPorMateria.set(fila.materiaId, fila);
  }

  const textoCoincide = hayBusqueda
    ? buscarEnArbol(flat, q, new Set<string>()).coincidencias
    : null;

  const resultados = new Set<string>();
  for (const [materiaId, fila] of filaPorMateria) {
    if (roles.get(materiaId) !== 'asignada') continue;
    if (!cumpleFiltro(fila, filtro)) continue;
    if (textoCoincide && !textoCoincide.has(materiaId)) continue;
    resultados.add(materiaId);
  }

  const coincidencias = hayBusqueda ? new Set(resultados) : new Set<string>();

  if (!hayRestriccion) {
    return {
      visibles: new Set(roles.keys()),
      expandir: new Set<string>(),
      coincidencias,
      total: resultados.size,
    };
  }

  const visibles = new Set<string>(resultados);
  const expandir = new Set<string>();
  for (const id of resultados) {
    const visitados = new Set<string>([id]);
    let actual = porId.get(id);
    while (actual && actual.parentId !== null && !visitados.has(actual.parentId)) {
      const padre = porId.get(actual.parentId);
      if (!padre) break;
      visitados.add(padre.id);
      if (roles.has(padre.id)) {
        visibles.add(padre.id);
        expandir.add(padre.id);
      }
      actual = padre;
    }
  }
  return { visibles, expandir, coincidencias, total: resultados.size };
}
