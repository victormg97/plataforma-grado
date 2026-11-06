/**
 * Pure helpers that compute the `Movimiento` of the tree edits (no React).
 *
 * - Row menu actions: move up, move down, indent, outdent (non-drag alternative, Requirement 12.6).
 * - Drag and drop projection: which parent and position a dragged row would take, from the row
 *   it hovers and the horizontal offset (as in the dnd-kit sortable-tree example, Requirement 4.10).
 *
 * Every function returns a move only when `validarMovimiento` accepts it, so the UI can disable
 * or highlight from the result and the same rules the database enforces (Requirements 4.14, 12.5).
 */

import { arrayMove } from '@dnd-kit/sortable';
import type { CedularioErrorCode } from '@/lib/cedularios/errors';
import {
  descendientes,
  hijosOrdenados,
  validarMovimiento,
  type FilaVisible,
  type MateriaNodo,
  type Movimiento,
  type RazonMovimientoInvalido,
  type ResultadoMovimiento,
} from '@/lib/cedularios/tree';

export type AccionMovimiento = 'subir' | 'bajar' | 'indentar' | 'desindentar';

/** The move of each menu action, or `null` when the action is not possible. */
export type MovimientosDisponibles = Record<AccionMovimiento, Movimiento | null>;

function esValido(flat: MateriaNodo[], mov: Movimiento): boolean {
  return validarMovimiento(flat, mov.id, mov.nuevoParentId).ok;
}

interface Contexto {
  nodo: MateriaNodo;
  hermanos: MateriaNodo[];
  indice: number;
}

/** The active materia, its active siblings (including itself) and its position among them. */
function contextoDe(flat: MateriaNodo[], id: string): Contexto | null {
  const nodo = flat.find((n) => n.id === id);
  if (!nodo || !nodo.activo) return null;
  const hermanos = hijosOrdenados(flat, nodo.parentId);
  const indice = hermanos.findIndex((h) => h.id === id);
  return indice < 0 ? null : { nodo, hermanos, indice };
}

/** Swaps places with the previous sibling: placed after the previous-previous one, or first. */
export function movimientoSubir(flat: MateriaNodo[], id: string): Movimiento | null {
  const ctx = contextoDe(flat, id);
  if (!ctx || ctx.indice === 0) return null;
  const mov: Movimiento = {
    id,
    nuevoParentId: ctx.nodo.parentId,
    despuesDeId: ctx.indice >= 2 ? ctx.hermanos[ctx.indice - 2].id : null,
  };
  return esValido(flat, mov) ? mov : null;
}

/** Swaps places with the next sibling: placed right after it. */
export function movimientoBajar(flat: MateriaNodo[], id: string): Movimiento | null {
  const ctx = contextoDe(flat, id);
  if (!ctx || ctx.indice === ctx.hermanos.length - 1) return null;
  const mov: Movimiento = {
    id,
    nuevoParentId: ctx.nodo.parentId,
    despuesDeId: ctx.hermanos[ctx.indice + 1].id,
  };
  return esValido(flat, mov) ? mov : null;
}

/**
 * Becomes the last child of the previous sibling. Not possible without a previous sibling, past
 * MAX_NIVEL, or when the código already exists among the previous sibling's children.
 */
export function movimientoIndentar(flat: MateriaNodo[], id: string): Movimiento | null {
  const ctx = contextoDe(flat, id);
  if (!ctx || ctx.indice === 0) return null;
  const nuevoPadre = ctx.hermanos[ctx.indice - 1];
  const hijos = hijosOrdenados(flat, nuevoPadre.id);
  const mov: Movimiento = {
    id,
    nuevoParentId: nuevoPadre.id,
    despuesDeId: hijos.length > 0 ? hijos[hijos.length - 1].id : null,
  };
  return esValido(flat, mov) ? mov : null;
}

/**
 * Moves one level up: placed right after its parent, under the grandparent. Not possible for a
 * root materia or when the código already exists among the grandparent's children.
 */
export function movimientoDesindentar(flat: MateriaNodo[], id: string): Movimiento | null {
  const ctx = contextoDe(flat, id);
  if (!ctx || ctx.nodo.parentId === null) return null;
  const padre = flat.find((n) => n.id === ctx.nodo.parentId);
  if (!padre) return null;
  const mov: Movimiento = { id, nuevoParentId: padre.parentId, despuesDeId: padre.id };
  return esValido(flat, mov) ? mov : null;
}

/** The four menu moves of a materia at once. */
export function movimientosDisponibles(flat: MateriaNodo[], id: string): MovimientosDisponibles {
  return {
    subir: movimientoSubir(flat, id),
    bajar: movimientoBajar(flat, id),
    indentar: movimientoIndentar(flat, id),
    desindentar: movimientoDesindentar(flat, id),
  };
}

/**
 * Error code (`errores.<code>`) shown when a move is rejected locally.
 * `null` for `mismo_lugar` (unknown materia: nothing to report).
 */
export function codigoErrorMovimiento(razon: RazonMovimientoInvalido): CedularioErrorCode | null {
  switch (razon) {
    case 'nivel_maximo':
      return 'nivel_maximo';
    case 'ciclo':
      return 'ciclo';
    case 'codigo_duplicado':
      return 'codigo_duplicado_nivel';
    case 'padre_inactivo':
      return 'padre_invalido';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Drag and drop projection
// ---------------------------------------------------------------------------

export interface ProyeccionArrastre {
  /** The move a drop would request. */
  movimiento: Movimiento;
  /** Depth (0 = root) the dragged row would have; drives the indicator indentation. */
  profundidad: number;
  /** Result of `validarMovimiento` for the projected parent. */
  validacion: ResultadoMovimiento;
  /** The drop would leave the materia where it already is. */
  sinCambio: boolean;
  /** Edge of the hovered row where the indicator line is drawn. */
  borde: 'arriba' | 'abajo';
}

export interface ArgumentosProyeccion {
  flat: MateriaNodo[];
  /** Visible rows, in order (output of `aplanarVisibles`). */
  filas: FilaVisible[];
  activoId: string;
  /** Row currently hovered by the drag (the dragged row itself at the start). */
  sobreId: string;
  /** Horizontal offset of the drag in indentation steps (positive = deeper). */
  niveles: number;
}

/** Ids of the descendants of a materia (kept out of the drop targets while it is dragged). */
export function idsOcultosAlArrastrar(flat: MateriaNodo[], activoId: string): Set<string> {
  return new Set(descendientes(flat, activoId).map((d) => d.id));
}

/**
 * Projects a drag onto `{ nuevoParentId, despuesDeId }` (Requirement 4.10, 12.4).
 *
 * The dragged row is virtually moved to the hovered row's index (descendants excluded). The
 * horizontal offset picks the depth, clamped to [depth of the next row, depth of the previous
 * row + 1]. The parent is derived from that depth and the position from the nearest row above
 * with the same depth. Dropping as the child of a collapsed materia appends to its children.
 * Returns `null` when the active or hovered row is not among the targets.
 */
export function proyectarArrastre({
  flat,
  filas,
  activoId,
  sobreId,
  niveles,
}: ArgumentosProyeccion): ProyeccionArrastre | null {
  const ocultos = idsOcultosAlArrastrar(flat, activoId);
  const items = filas.filter((f) => !ocultos.has(f.nodo.id));
  const indiceActivo = items.findIndex((f) => f.nodo.id === activoId);
  const indiceSobre = items.findIndex((f) => f.nodo.id === sobreId);
  if (indiceActivo < 0 || indiceSobre < 0) return null;

  const activa = items[indiceActivo];
  const nuevos = arrayMove(items, indiceActivo, indiceSobre);
  const previa = nuevos[indiceSobre - 1] as FilaVisible | undefined;
  const siguiente = nuevos[indiceSobre + 1] as FilaVisible | undefined;

  const maxima = previa ? previa.profundidad + 1 : 0;
  const minima = Math.min(siguiente ? siguiente.profundidad : 0, maxima);
  const profundidad = Math.min(Math.max(activa.profundidad + niveles, minima), maxima);

  let nuevoParentId: string | null;
  if (profundidad === 0 || !previa) nuevoParentId = null;
  else if (profundidad === previa.profundidad) nuevoParentId = previa.nodo.parentId;
  else if (profundidad > previa.profundidad) nuevoParentId = previa.nodo.id;
  else {
    nuevoParentId =
      nuevos
        .slice(0, indiceSobre)
        .reverse()
        .find((f) => f.profundidad === profundidad)?.nodo.parentId ?? null;
  }

  // Nearest row above at the same depth is the previous sibling; reaching a shallower row first
  // means the dragged row is the first child of that row.
  let despuesDeId: string | null = null;
  for (let k = indiceSobre - 1; k >= 0; k -= 1) {
    const fila = nuevos[k];
    if (fila.profundidad === profundidad) {
      despuesDeId = fila.nodo.id;
      break;
    }
    if (fila.profundidad < profundidad) {
      if (fila.nodo.id === nuevoParentId && fila.tieneHijos && !fila.expandido) {
        const hijos = hijosOrdenados(flat, nuevoParentId).filter((h) => h.id !== activoId);
        despuesDeId = hijos.length > 0 ? hijos[hijos.length - 1].id : null;
      }
      break;
    }
  }

  const nodoActivo = activa.nodo;
  const hermanosActuales = hijosOrdenados(flat, nodoActivo.parentId);
  const posicionActual = hermanosActuales.findIndex((h) => h.id === activoId);
  const hermanoPrevioActual = posicionActual > 0 ? hermanosActuales[posicionActual - 1].id : null;

  return {
    movimiento: { id: activoId, nuevoParentId, despuesDeId },
    profundidad,
    validacion: validarMovimiento(flat, activoId, nuevoParentId),
    sinCambio: nuevoParentId === nodoActivo.parentId && despuesDeId === hermanoPrevioActual,
    borde: indiceActivo < indiceSobre ? 'abajo' : 'arriba',
  };
}
