/**
 * Pure materia-tree model (no React, no Supabase).
 *
 * Mirrors the database rules so the UI can validate and update optimistically:
 * - depth is at most MAX_NIVEL, counting the descendants of a moved materia (CD001)
 * - the hierarchy is acyclic (CD002)
 * - the parent of a created, moved or reactivated materia must be active (CD003)
 * - código is unique among active siblings, case-insensitive (uq_materias_codigo_hermanos)
 * - active children are ordered by (orden, id)
 * - soft delete deactivates the materia and its currently active descendants only,
 *   and returns exactly the ids it changed (no active materia under an inactive one)
 * - restore reactivates in ascending nivel, so a parent is active before its children
 *
 * All functions are total and never mutate their input.
 */

import { codigoDisponible } from './codigo';
import { ORDEN_PASO, ordenEntre, rebalancear } from './orden';

export const MAX_NIVEL = 10;

export interface MateriaNodo {
  id: string;
  parentId: string | null;
  nivel: number;
  orden: number;
  activo: boolean;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

export type RazonMovimientoInvalido =
  | 'ciclo'
  | 'nivel_maximo'
  | 'padre_inactivo'
  | 'codigo_duplicado'
  | 'mismo_lugar';

export type ResultadoMovimiento = { ok: true } | { ok: false; razon: RazonMovimientoInvalido };

/**
 * A move request, same arguments as the `mover_materia` RPC.
 * `despuesDeId` is the sibling (under `nuevoParentId`) after which the materia is placed;
 * `null` means first position.
 */
export interface Movimiento {
  id: string;
  nuevoParentId: string | null;
  despuesDeId: string | null;
}

export type ResultadoRestauracion =
  | { ok: true; flat: MateriaNodo[] }
  | { ok: false; razon: 'codigo_duplicado' | 'padre_inactivo' | 'no_encontrada'; id: string };

export interface FilaVisible {
  nodo: MateriaNodo;
  /** 0 for root materias. */
  profundidad: number;
  /** True when the materia has at least one active child. */
  tieneHijos: boolean;
  expandido: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function compararHermanos(a: MateriaNodo, b: MateriaNodo): number {
  if (a.orden !== b.orden) return a.orden < b.orden ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Children grouped by parentId, each group sorted by (orden, id). */
function indexarHijos(flat: MateriaNodo[], soloActivos: boolean): Map<string | null, MateriaNodo[]> {
  const mapa = new Map<string | null, MateriaNodo[]>();
  for (const n of flat) {
    if (soloActivos && !n.activo) continue;
    const lista = mapa.get(n.parentId);
    if (lista) lista.push(n);
    else mapa.set(n.parentId, [n]);
  }
  for (const lista of mapa.values()) lista.sort(compararHermanos);
  return mapa;
}

function indexarPorId(flat: MateriaNodo[]): Map<string, MateriaNodo> {
  const mapa = new Map<string, MateriaNodo>();
  for (const n of flat) mapa.set(n.id, n);
  return mapa;
}

/** Descendants of `id` (any activo state) in breadth-first order, i.e. ascending nivel. */
function descendientesDesde(hijos: Map<string | null, MateriaNodo[]>, id: string): MateriaNodo[] {
  const resultado: MateriaNodo[] = [];
  const visitados = new Set<string>([id]);
  let frontera: string[] = [id];
  while (frontera.length > 0) {
    const siguiente: string[] = [];
    for (const padreId of frontera) {
      for (const h of hijos.get(padreId) ?? []) {
        if (visitados.has(h.id)) continue;
        visitados.add(h.id);
        resultado.push(h);
        siguiente.push(h.id);
      }
    }
    frontera = siguiente;
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Active children of `parentId` (null = roots), ascending (orden, id). */
export function hijosOrdenados(flat: MateriaNodo[], parentId: string | null): MateriaNodo[] {
  return flat.filter((n) => n.activo && n.parentId === parentId).sort(compararHermanos);
}

/**
 * All descendants of `id` regardless of activo state, in breadth-first order
 * (ascending nivel, then (orden, id)). Does not include `id` itself.
 */
export function descendientes(flat: MateriaNodo[], id: string): MateriaNodo[] {
  return descendientesDesde(indexarHijos(flat, false), id);
}

/** Ancestors of `id` ordered from the root down to its direct parent. Empty for a root or unknown id. */
export function ancestros(flat: MateriaNodo[], id: string): MateriaNodo[] {
  const porId = indexarPorId(flat);
  const resultado: MateriaNodo[] = [];
  const visitados = new Set<string>([id]);
  let actual = porId.get(id);
  while (actual && actual.parentId !== null && !visitados.has(actual.parentId)) {
    const padre = porId.get(actual.parentId);
    if (!padre) break;
    visitados.add(padre.id);
    resultado.push(padre);
    actual = padre;
  }
  return resultado.reverse();
}

/** Height of the subtree rooted at `id`, counting every descendant: 1 = leaf, 0 = unknown id. */
export function alturaSubarbol(flat: MateriaNodo[], id: string): number {
  if (!flat.some((n) => n.id === id)) return 0;
  const hijos = indexarHijos(flat, false);
  const visitados = new Set<string>([id]);
  let frontera: string[] = [id];
  let altura = 1;
  for (;;) {
    const siguiente: string[] = [];
    for (const padreId of frontera) {
      for (const h of hijos.get(padreId) ?? []) {
        if (visitados.has(h.id)) continue;
        visitados.add(h.id);
        siguiente.push(h.id);
      }
    }
    if (siguiente.length === 0) return altura;
    altura += 1;
    frontera = siguiente;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Whether a new materia can be created under `parentId` (null = root level). */
export function puedeCrearHijo(flat: MateriaNodo[], parentId: string | null): ResultadoMovimiento {
  if (parentId === null) return { ok: true };
  const padre = flat.find((n) => n.id === parentId);
  if (!padre || !padre.activo) return { ok: false, razon: 'padre_inactivo' };
  if (padre.nivel + 1 > MAX_NIVEL) return { ok: false, razon: 'nivel_maximo' };
  return { ok: true };
}

/**
 * Whether materia `id` can become a child of `nuevoParentId` (null = root).
 * Checks, in order: cycle, active parent, depth (including every descendant of `id`),
 * and código collision among the active siblings of the target parent. Moving within the
 * same parent (a plain reorder) is valid. An unknown `id` has nothing to move and yields
 * `mismo_lugar`.
 */
export function validarMovimiento(
  flat: MateriaNodo[],
  id: string,
  nuevoParentId: string | null,
): ResultadoMovimiento {
  const porId = indexarPorId(flat);
  const materia = porId.get(id);
  if (!materia) return { ok: false, razon: 'mismo_lugar' };

  if (nuevoParentId !== null) {
    // Cycle: `id` must not be the new parent or any ancestor of the new parent.
    const visitados = new Set<string>();
    let actual = porId.get(nuevoParentId);
    while (actual && !visitados.has(actual.id)) {
      if (actual.id === id) return { ok: false, razon: 'ciclo' };
      visitados.add(actual.id);
      actual = actual.parentId !== null ? porId.get(actual.parentId) : undefined;
    }

    const padre = porId.get(nuevoParentId);
    if (!padre || !padre.activo) return { ok: false, razon: 'padre_inactivo' };
  }

  const padre = nuevoParentId !== null ? porId.get(nuevoParentId) : undefined;
  const nuevoNivel = padre ? padre.nivel + 1 : 1;
  if (nuevoNivel + alturaSubarbol(flat, id) - 1 > MAX_NIVEL) {
    return { ok: false, razon: 'nivel_maximo' };
  }

  if (materia.activo) {
    const hermanos = hijosOrdenados(flat, nuevoParentId).filter((h) => h.id !== id);
    if (!codigoDisponible(hermanos, materia.codigo, id)) {
      return { ok: false, razon: 'codigo_duplicado' };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mutations (pure, return new arrays)
// ---------------------------------------------------------------------------

/**
 * Applies a move the way `mover_materia` does: new parent, `orden` at the floor-midpoint of
 * the two neighbors (siblings are renumbered at multiples of ORDEN_PASO when no integer fits),
 * and nivel recomputed for the moved materia and all its descendants. Other siblings keep
 * their relative order. Returns the input array unchanged when the move is invalid or
 * `despuesDeId` is not an active sibling under the target parent.
 */
export function aplicarMovimiento(flat: MateriaNodo[], mov: Movimiento): MateriaNodo[] {
  if (!validarMovimiento(flat, mov.id, mov.nuevoParentId).ok) return flat;
  if (mov.despuesDeId === mov.id) return flat;

  const porId = indexarPorId(flat);
  const materia = porId.get(mov.id);
  if (!materia) return flat;

  let hermanos = hijosOrdenados(flat, mov.nuevoParentId).filter((h) => h.id !== mov.id);

  const vecinos = (lista: MateriaNodo[]): { prev: number | null; next: number | null } | null => {
    if (mov.despuesDeId === null) {
      return { prev: null, next: lista.length > 0 ? lista[0].orden : null };
    }
    const i = lista.findIndex((h) => h.id === mov.despuesDeId);
    if (i < 0) return null;
    return { prev: lista[i].orden, next: i + 1 < lista.length ? lista[i + 1].orden : null };
  };

  const ordenesNuevos = new Map<string, number>();
  let v = vecinos(hermanos);
  if (!v) return flat;
  let colocacion = ordenEntre(v.prev, v.next);
  if (colocacion.tipo === 'rebalancear') {
    hermanos = rebalancear(hermanos);
    for (const h of hermanos) ordenesNuevos.set(h.id, h.orden);
    v = vecinos(hermanos);
    if (!v) return flat;
    colocacion = ordenEntre(v.prev, v.next);
  }
  // After a rebalance the gap is ORDEN_PASO, so a value always fits.
  const nuevoOrden =
    colocacion.tipo === 'valor' ? colocacion.orden : (v.prev ?? 0) + ORDEN_PASO;

  const padre = mov.nuevoParentId !== null ? porId.get(mov.nuevoParentId) : undefined;
  const nuevoNivel = padre ? padre.nivel + 1 : 1;
  const deltaNivel = nuevoNivel - materia.nivel;
  const idsDescendientes = new Set(descendientes(flat, mov.id).map((d) => d.id));

  return flat.map((n) => {
    if (n.id === mov.id) {
      return { ...n, parentId: mov.nuevoParentId, orden: nuevoOrden, nivel: nuevoNivel };
    }
    const ordenReasignado = ordenesNuevos.get(n.id);
    if (idsDescendientes.has(n.id)) {
      return deltaNivel === 0 ? n : { ...n, nivel: n.nivel + deltaNivel };
    }
    if (ordenReasignado !== undefined && ordenReasignado !== n.orden) {
      return { ...n, orden: ordenReasignado };
    }
    return n;
  });
}

/**
 * Soft delete: deactivates materia `id` and each of its currently active descendants.
 * Already-inactive descendants are untouched. `ids` are exactly the materias changed, in
 * ascending nivel (ancestors first). An unknown or already-inactive `id` changes nothing.
 */
export function desactivarSubarbol(
  flat: MateriaNodo[],
  id: string,
): { flat: MateriaNodo[]; ids: string[] } {
  const raiz = flat.find((n) => n.id === id);
  if (!raiz || !raiz.activo) return { flat, ids: [] };

  const activosDescendientes = descendientesDesde(indexarHijos(flat, true), id);
  const ids = [id, ...activosDescendientes.map((d) => d.id)];
  const cambiar = new Set(ids);
  return {
    flat: flat.map((n) => (cambiar.has(n.id) ? { ...n, activo: false } : n)),
    ids,
  };
}

/**
 * Undo of a soft delete. Reactivates `ids` one at a time in ascending nivel (ties keep the
 * given order), so a parent is active before its children. All-or-nothing: if any materia
 * has an inactive parent or its código collides with an active sibling, nothing is restored
 * and the offending id is reported.
 */
export function restaurarMaterias(flat: MateriaNodo[], ids: string[]): ResultadoRestauracion {
  const porId = indexarPorId(flat);
  const unicos = Array.from(new Set(ids));

  for (const id of unicos) {
    if (!porId.has(id)) return { ok: false, razon: 'no_encontrada', id };
  }

  const ordenados = unicos
    .map((id, posicion) => ({ nodo: porId.get(id) as MateriaNodo, posicion }))
    .sort((a, b) => a.nodo.nivel - b.nodo.nivel || a.posicion - b.posicion)
    .map((x) => x.nodo.id);

  const activos = new Map<string, MateriaNodo>();
  for (const n of flat) activos.set(n.id, n);

  for (const id of ordenados) {
    const nodo = activos.get(id) as MateriaNodo;
    if (nodo.activo) continue;

    if (nodo.parentId !== null) {
      const padre = activos.get(nodo.parentId);
      if (!padre || !padre.activo) return { ok: false, razon: 'padre_inactivo', id };
    }

    const hermanos: MateriaNodo[] = [];
    for (const otro of activos.values()) {
      if (otro.parentId === nodo.parentId && otro.id !== id) hermanos.push(otro);
    }
    if (!codigoDisponible(hermanos, nodo.codigo, id)) {
      return { ok: false, razon: 'codigo_duplicado', id };
    }

    activos.set(id, { ...nodo, activo: true });
  }

  return { ok: true, flat: flat.map((n) => activos.get(n.id) ?? n) };
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

/** Count of active materias per nivel 1 to MAX_NIVEL (0 when a nivel is empty). */
export function conteoPorNivel(flat: MateriaNodo[]): Record<number, number> {
  const conteo: Record<number, number> = {};
  for (let nivel = 1; nivel <= MAX_NIVEL; nivel += 1) conteo[nivel] = 0;
  for (const n of flat) {
    if (!n.activo) continue;
    if (n.nivel >= 1 && n.nivel <= MAX_NIVEL) conteo[n.nivel] += 1;
  }
  return conteo;
}

/**
 * Depth-first flattening of the active tree for rendering: roots first, each materia
 * followed by its children (ordered by (orden, id)) only when it is in `expandidos`.
 */
export function aplanarVisibles(flat: MateriaNodo[], expandidos: ReadonlySet<string>): FilaVisible[] {
  const hijos = indexarHijos(flat, true);
  const filas: FilaVisible[] = [];
  const visitados = new Set<string>();

  const visitar = (nodo: MateriaNodo, profundidad: number): void => {
    if (visitados.has(nodo.id)) return;
    visitados.add(nodo.id);
    const hijosNodo = hijos.get(nodo.id) ?? [];
    const expandido = hijosNodo.length > 0 && expandidos.has(nodo.id);
    filas.push({ nodo, profundidad, tieneHijos: hijosNodo.length > 0, expandido });
    if (expandido) {
      for (const h of hijosNodo) visitar(h, profundidad + 1);
    }
  };

  for (const raiz of hijos.get(null) ?? []) visitar(raiz, 0);
  return filas;
}
