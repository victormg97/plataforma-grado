/**
 * Pure logic of the "assign cedulario" wizard (no React, no Supabase).
 *
 * Steps: `seleccion` (cedularios, or students when the cedulario is fixed), `materias` (one
 * cedulario at a time) and `confirmar`. Every rule that decides what the wizard does lives here
 * so it can be unit tested: selection without duplicates, "select all" per universidad, keeping
 * the choices when going back, branch actions with protection against losing a selection, close
 * protection (progress detection) and the summary of the per-cedulario results.
 */

import type { MateriaNodo } from '@/lib/cedularios/tree';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasoWizard = 'seleccion' | 'materias' | 'confirmar';

/**
 * - `alumno`: student fixed, the user picks cedularios (3 steps).
 * - `cedulario`: cedulario fixed, the user picks students (3 steps).
 * - `reasignar`: both fixed, one cedulario, 2 steps (materias and confirm).
 */
export type ModoWizard = 'alumno' | 'cedulario' | 'reasignar';

/** Value of the materia picker: every active materia, or an explicit list of materia ids. */
export type SeleccionMaterias = 'todas' | string[];

export interface EstadoWizard {
  paso: PasoWizard;
  /** Chosen cedulario ids, in the order they were chosen. */
  cedularioIds: string[];
  /** Chosen student ids (only used when the cedulario is fixed). */
  alumnoIds: string[];
  /** Materia choice per cedulario id. */
  materias: Record<string, SeleccionMaterias>;
  /** Cedulario being edited in the `materias` step (index in `cedularioIds`). */
  indiceMaterias: number;
}

export interface EnvioCedulario {
  cedularioId: string;
  materias: SeleccionMaterias;
}

/** Outcome of the assignment of one cedulario to the fixed student. */
export type ResultadoAsignacionCedulario =
  | { cedularioId: string; resultado: 'asignado' | 'reactivado'; asignacionId: string }
  | { cedularioId: string; resultado: 'rechazado'; motivo: string };

export interface ResumenResultados {
  asignados: number;
  reactivados: number;
  /** Cedularios the student already had active (nothing was created). */
  yaAsignados: number;
  /** Cedulario ids that failed and can be retried. */
  fallidos: string[];
}

export interface EstadoGrupo {
  seleccionados: number;
  seleccionables: number;
  todos: boolean;
  ninguno: boolean;
}

/** Motivo returned by the RPC when the student already has the cedulario active. */
export const MOTIVO_YA_ASIGNADO = 'asignacion_duplicada';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export function pasosDelModo(modo: ModoWizard): PasoWizard[] {
  return modo === 'reasignar' ? ['materias', 'confirmar'] : ['seleccion', 'materias', 'confirmar'];
}

export function pasoInicial(modo: ModoWizard): PasoWizard {
  return pasosDelModo(modo)[0];
}

export function pasoSiguiente(modo: ModoWizard, paso: PasoWizard): PasoWizard {
  const pasos = pasosDelModo(modo);
  const indice = pasos.indexOf(paso);
  return pasos[Math.min(pasos.length - 1, indice + 1)] ?? paso;
}

export function pasoAnterior(modo: ModoWizard, paso: PasoWizard): PasoWizard {
  const pasos = pasosDelModo(modo);
  const indice = pasos.indexOf(paso);
  return pasos[Math.max(0, indice - 1)] ?? paso;
}

// ---------------------------------------------------------------------------
// Selection of cedularios
// ---------------------------------------------------------------------------

type Conjunto = ReadonlySet<string> | readonly string[];

function aSet(valores: Conjunto): Set<string> {
  return new Set(Array.from(valores, (valor) => valor.toLowerCase()));
}

/** Toggles one id. Ids already assigned are ignored. Never creates duplicates; keeps the order. */
export function alternarCedulario(
  ids: readonly string[],
  id: string,
  yaAsignados: Conjunto,
): string[] {
  const asignados = aSet(yaAsignados);
  const clave = id.toLowerCase();
  const presente = ids.some((actual) => actual.toLowerCase() === clave);
  if (presente) return ids.filter((actual) => actual.toLowerCase() !== clave);
  if (asignados.has(clave)) return [...ids];
  return [...ids, id];
}

/** "Select all" of a universidad: adds the selectable ids of the group, the rest is untouched. */
export function seleccionarGrupo(
  ids: readonly string[],
  grupoIds: readonly string[],
  yaAsignados: Conjunto,
): string[] {
  const asignados = aSet(yaAsignados);
  const resultado = [...ids];
  const presentes = aSet(ids);
  for (const id of grupoIds) {
    const clave = id.toLowerCase();
    if (asignados.has(clave) || presentes.has(clave)) continue;
    presentes.add(clave);
    resultado.push(id);
  }
  return resultado;
}

/** "Deselect all" of a universidad: removes only the ids of the group. */
export function deseleccionarGrupo(ids: readonly string[], grupoIds: readonly string[]): string[] {
  const grupo = aSet(grupoIds);
  return ids.filter((id) => !grupo.has(id.toLowerCase()));
}

/** Counters of a universidad group, used to disable its header buttons. */
export function estadoGrupo(
  ids: readonly string[],
  grupoIds: readonly string[],
  yaAsignados: Conjunto,
): EstadoGrupo {
  const asignados = aSet(yaAsignados);
  const elegidos = aSet(ids);
  const seleccionables = grupoIds.filter((id) => !asignados.has(id.toLowerCase()));
  const seleccionados = seleccionables.filter((id) => elegidos.has(id.toLowerCase())).length;
  return {
    seleccionados,
    seleccionables: seleccionables.length,
    todos: seleccionables.length > 0 && seleccionados === seleccionables.length,
    ninguno: seleccionados === 0,
  };
}

/**
 * Cleans a selection: removes duplicates (case-insensitive), ids the student already has and,
 * when `disponibles` is given, ids that are no longer available. Idempotent.
 */
export function depurarCedularios(
  ids: readonly string[],
  yaAsignados: Conjunto,
  disponibles?: Conjunto,
): string[] {
  const asignados = aSet(yaAsignados);
  const validos = disponibles ? aSet(disponibles) : null;
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const id of ids) {
    const clave = id.toLowerCase();
    if (vistos.has(clave) || asignados.has(clave)) continue;
    if (validos && !validos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(id);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Materias per cedulario
// ---------------------------------------------------------------------------

/** Default materias of the chosen cedularios; `previas` keeps what was already decided. */
export function materiasPorDefecto(
  ids: readonly string[],
  previas: Readonly<Record<string, SeleccionMaterias>> = {},
): Record<string, SeleccionMaterias> {
  const resultado: Record<string, SeleccionMaterias> = {};
  for (const id of ids) resultado[id] = previas[id] ?? 'todas';
  return resultado;
}

/**
 * Aligns the materias with the chosen cedularios: drops the entries of deselected cedularios
 * and adds `'todas'` for the new ones. Entries of cedularios that stay are kept, so going back
 * and forth never loses a choice.
 */
export function sincronizarMaterias(
  materias: Readonly<Record<string, SeleccionMaterias>>,
  cedularioIds: readonly string[],
): Record<string, SeleccionMaterias> {
  return materiasPorDefecto(cedularioIds, materias);
}

function mismaSeleccion(a: SeleccionMaterias, b: SeleccionMaterias): boolean {
  if (a === 'todas' || b === 'todas') return a === b;
  if (a.length !== b.length) return false;
  const conjunto = new Set(a);
  return b.every((id) => conjunto.has(id));
}

// ---------------------------------------------------------------------------
// Branch actions of the materia tree
// ---------------------------------------------------------------------------

/** Ids of every active materia. */
export function idsTodasLasRamas(flat: readonly MateriaNodo[]): string[] {
  return flat.filter((nodo) => nodo.activo).map((nodo) => nodo.id);
}

/** Ids of the active materias that have at least one active child (the ones that expand). */
export function idsConHijos(flat: readonly MateriaNodo[]): string[] {
  const activos = flat.filter((nodo) => nodo.activo);
  const padres = new Set<string>();
  for (const nodo of activos) {
    if (nodo.parentId !== null) padres.add(nodo.parentId);
  }
  return activos.filter((nodo) => padres.has(nodo.id)).map((nodo) => nodo.id);
}

export interface ResultadoAccionRamas {
  /** True when the action would discard an existing selection: ask first. */
  requiereConfirmacion: boolean;
  siguiente: Set<string>;
}

/**
 * "Mark all branches" is a union and never loses the current selection. "Unmark all branches"
 * empties it, so it needs a confirmation when something is selected.
 */
export function accionRamas(params: {
  accion: 'marcar' | 'desmarcar';
  seleccion: ReadonlySet<string>;
  flat: readonly MateriaNodo[];
}): ResultadoAccionRamas {
  const { accion, seleccion, flat } = params;
  if (accion === 'marcar') {
    return {
      requiereConfirmacion: false,
      siguiente: new Set([...seleccion, ...idsTodasLasRamas(flat)]),
    };
  }
  return { requiereConfirmacion: seleccion.size > 0, siguiente: new Set() };
}

// ---------------------------------------------------------------------------
// Navigation, progress and submit
// ---------------------------------------------------------------------------

/** Whether the wizard can leave the current step (or the current cedulario of the materias step). */
export function puedeAvanzar(modo: ModoWizard, estado: EstadoWizard): boolean {
  if (estado.paso === 'seleccion') {
    return modo === 'cedulario' ? estado.alumnoIds.length > 0 : estado.cedularioIds.length > 0;
  }
  if (estado.paso === 'materias') {
    const id = estado.cedularioIds[estado.indiceMaterias];
    if (id === undefined) return false;
    const seleccion = estado.materias[id] ?? 'todas';
    return seleccion === 'todas' || seleccion.length > 0;
  }
  return true;
}

/**
 * Whether the user has something to lose: any chosen cedulario or student, or a materia choice
 * that differs from the default (`materiasIniciales` in reassign mode, `'todas'` otherwise).
 */
export function hayProgreso(
  estado: EstadoWizard,
  modo: ModoWizard,
  materiasIniciales: SeleccionMaterias = 'todas',
): boolean {
  if (modo === 'alumno' && estado.cedularioIds.length > 0) return true;
  if (modo === 'cedulario' && estado.alumnoIds.length > 0) return true;
  const base = modo === 'reasignar' ? materiasIniciales : 'todas';
  return Object.values(estado.materias).some((seleccion) => !mismaSeleccion(seleccion, base));
}

/** Payload of the save, one entry per chosen cedulario in the order they were chosen. */
export function construirEnvio(estado: EstadoWizard): EnvioCedulario[] {
  return estado.cedularioIds.map((cedularioId) => ({
    cedularioId,
    materias: estado.materias[cedularioId] ?? 'todas',
  }));
}

export function resumirResultados(
  resultados: readonly ResultadoAsignacionCedulario[],
): ResumenResultados {
  const resumen: ResumenResultados = { asignados: 0, reactivados: 0, yaAsignados: 0, fallidos: [] };
  for (const fila of resultados) {
    if (fila.resultado === 'asignado') resumen.asignados += 1;
    else if (fila.resultado === 'reactivado') resumen.reactivados += 1;
    else if (fila.resultado === 'rechazado' && fila.motivo === MOTIVO_YA_ASIGNADO) {
      resumen.yaAsignados += 1;
    } else resumen.fallidos.push(fila.cedularioId);
  }
  return resumen;
}
