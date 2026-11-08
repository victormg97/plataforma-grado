/**
 * Parent / child coverage of the tracking tree (cascade).
 * Pure module: no React, no Supabase.
 *
 * - Checking a materia covers it and every assigned descendant; unchecking makes them pending.
 * - Ancestors with a progress row are kept in sync in the same batch: when every assigned
 *   descendant is covered the ancestor becomes covered; when a descendant becomes pending a
 *   covered ancestor becomes pending. The change is monotonic in the direction of the action, so
 *   checking never unchecks an ancestor and unchecking never checks one (old data where a parent
 *   was covered with pending children is not "fixed" by an unrelated check).
 * - Context ancestors (no row) are never written: their checkbox is derived from the aggregate.
 *
 * Only assigned rows of active materias count, the same rule as `construirAgregados`.
 */
import type { MateriaNodo } from '../tree';
import type { Agregado } from './agregados';
import type { Cobertura, ProgresoFila } from './tipos';

/** Checkbox state of a branch: every, some or none of its assigned materias covered. */
export type EstadoVisual = 'todas' | 'algunas' | 'ninguna';

/** Rows to change, as progress ids. Both lists are disjoint and contain only real changes. */
export interface PlanCascada {
  cubiertas: string[];
  pendientes: string[];
  /** Rows of the materia and its descendants that go from covered to pending (lose their date). */
  perdidas: number;
}

export const PLAN_VACIO: PlanCascada = { cubiertas: [], pendientes: [], perdidas: 0 };

/** Unchecking a branch that loses this many dates or more asks for confirmation. */
export const UMBRAL_CONFIRMAR_PERDIDAS = 2;

export function estadoVisual(agregado: Agregado | undefined): EstadoVisual {
  if (!agregado || agregado.total === 0 || agregado.cubiertas === 0) return 'ninguna';
  return agregado.cubiertas >= agregado.total ? 'todas' : 'algunas';
}

/** What a click on the checkbox does: anything not fully covered becomes covered. */
export function objetivoAlternar(agregado: Agregado | undefined): Cobertura {
  return estadoVisual(agregado) === 'todas' ? 'pendiente' : 'cubierta';
}

export function requiereConfirmacion(perdidas: number): boolean {
  return perdidas >= UMBRAL_CONFIRMAR_PERDIDAS;
}

export function planVacio(plan: PlanCascada): boolean {
  return plan.cubiertas.length === 0 && plan.pendientes.length === 0;
}

export interface PlanificarCascadaArgs {
  flat: MateriaNodo[];
  progreso: ProgresoFila[];
  materiaId: string;
  objetivo: Cobertura;
}

export function planificarCascada({
  flat,
  progreso,
  materiaId,
  objetivo,
}: PlanificarCascadaArgs): PlanCascada {
  const porId = new Map<string, MateriaNodo>();
  const hijos = new Map<string, string[]>();
  for (const nodo of flat) {
    porId.set(nodo.id, nodo);
    if (nodo.parentId === null) continue;
    const lista = hijos.get(nodo.parentId);
    if (lista) lista.push(nodo.id);
    else hijos.set(nodo.parentId, [nodo.id]);
  }
  if (!porId.has(materiaId)) return PLAN_VACIO;

  // Assigned rows of active materias, by materia.
  const filaPorMateria = new Map<string, ProgresoFila>();
  for (const fila of progreso) {
    if (!fila.asignada) continue;
    const materia = porId.get(fila.materiaId);
    if (!materia || !materia.activo) continue;
    filaPorMateria.set(fila.materiaId, fila);
  }

  /** Materia ids of the subtree of `raiz`, `raiz` included. Guards against cycles. */
  const subarbol = (raiz: string): string[] => {
    const ids: string[] = [];
    const visitados = new Set<string>();
    const pila = [raiz];
    while (pila.length > 0) {
      const id = pila.pop() as string;
      if (visitados.has(id)) continue;
      visitados.add(id);
      ids.push(id);
      for (const hijo of hijos.get(id) ?? []) pila.push(hijo);
    }
    return ids;
  };

  // State after the change, by progress id (starts as stored).
  const nuevo = new Map<string, Cobertura>();
  const estadoDe = (fila: ProgresoFila) => nuevo.get(fila.id) ?? fila.estado;

  // (1) The materia and every assigned descendant.
  const propios = new Set(subarbol(materiaId));
  for (const id of propios) {
    const fila = filaPorMateria.get(id);
    if (fila) nuevo.set(fila.id, objetivo);
  }

  // (2) Ancestors, bottom-up, up to the root.
  const visitados = new Set<string>(propios);
  let padreId = porId.get(materiaId)?.parentId ?? null;
  while (padreId !== null && !visitados.has(padreId)) {
    visitados.add(padreId);
    const padre = porId.get(padreId);
    if (!padre) break;
    const filaPadre = filaPorMateria.get(padreId);
    if (filaPadre) {
      let total = 0;
      let cubiertas = 0;
      for (const id of subarbol(padreId)) {
        if (id === padreId) continue;
        const fila = filaPorMateria.get(id);
        if (!fila) continue;
        total += 1;
        if (estadoDe(fila) === 'cubierta') cubiertas += 1;
      }
      if (total > 0) {
        const todas = cubiertas === total;
        if (objetivo === 'cubierta' && todas) nuevo.set(filaPadre.id, 'cubierta');
        if (objetivo === 'pendiente' && !todas) nuevo.set(filaPadre.id, 'pendiente');
      }
    }
    padreId = padre.parentId;
  }

  // Nothing of the branch changes (already in the target, or no assigned rows): the ancestors are
  // left as they are, so a no-op click never rewrites old inconsistent data elsewhere.
  let cambiaRama = false;
  for (const id of propios) {
    const fila = filaPorMateria.get(id);
    if (fila && fila.estado !== objetivo) {
      cambiaRama = true;
      break;
    }
  }
  if (!cambiaRama) return PLAN_VACIO;

  // (3) Only real changes.
  const cubiertasPlan: string[] = [];
  const pendientesPlan: string[] = [];
  let perdidas = 0;
  for (const fila of filaPorMateria.values()) {
    const destino = nuevo.get(fila.id);
    if (destino === undefined || destino === fila.estado) continue;
    if (destino === 'cubierta') {
      cubiertasPlan.push(fila.id);
    } else {
      pendientesPlan.push(fila.id);
      if (propios.has(fila.materiaId)) perdidas += 1;
    }
  }
  return { cubiertas: cubiertasPlan, pendientes: pendientesPlan, perdidas };
}

/**
 * Applies a plan to the cached list (same date rule as `aplicarEstadoOptimista` and the RPC:
 * a newly covered row gets `hoy`, an already covered one keeps its date, pending clears it).
 * Returns a new list; untouched rows keep their identity.
 */
export function aplicarLoteOptimista(
  filas: ProgresoFila[],
  plan: PlanCascada,
  hoy: string,
): ProgresoFila[] {
  if (planVacio(plan)) return filas;
  const cubrir = new Set(plan.cubiertas);
  const pendientes = new Set(plan.pendientes);
  return filas.map((fila) => {
    if (cubrir.has(fila.id)) {
      if (fila.estado === 'cubierta' && fila.fechaCubierta) return fila;
      return { ...fila, estado: 'cubierta', fechaCubierta: hoy };
    }
    if (pendientes.has(fila.id)) {
      if (fila.estado === 'pendiente' && fila.fechaCubierta === null) return fila;
      return { ...fila, estado: 'pendiente', fechaCubierta: null };
    }
    return fila;
  });
}

/** Puts every row of `previas` back in place (rows no longer in the list are ignored). */
export function restaurarFilas(filas: ProgresoFila[], previas: readonly ProgresoFila[]): ProgresoFila[] {
  if (previas.length === 0) return filas;
  const porId = new Map(previas.map((fila) => [fila.id, fila]));
  return filas.map((fila) => porId.get(fila.id) ?? fila);
}
