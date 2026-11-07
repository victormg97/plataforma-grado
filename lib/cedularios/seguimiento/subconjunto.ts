/**
 * Editable subset of assigned materias.
 * Pure module: no React, no Supabase.
 *
 * Removing a materia from the subset archives it (asignada = false): its progress data is kept.
 */

import { descendientes, type MateriaNodo } from '../tree';
import type { ProgresoFila } from './tipos';

/**
 * Difference between the current subset and the new one.
 * `agregar` = nuevos minus actuales, `quitar` = actuales minus nuevos. Both are disjoint.
 */
export function diferenciaSubconjunto(
  actuales: ReadonlySet<string>,
  nuevos: ReadonlySet<string>,
): { agregar: string[]; quitar: string[] } {
  const agregar: string[] = [];
  const quitar: string[] = [];
  for (const id of nuevos) {
    if (!actuales.has(id)) agregar.push(id);
  }
  for (const id of actuales) {
    if (!nuevos.has(id)) quitar.push(id);
  }
  return { agregar, quitar };
}

/**
 * The materia `id` plus all its active descendants, in breadth-first order.
 * Empty when `id` is unknown or inactive.
 */
export function ramaActiva(flat: MateriaNodo[], id: string): string[] {
  const raiz = flat.find((n) => n.id === id);
  if (!raiz || !raiz.activo) return [];
  const ids = [raiz.id];
  for (const d of descendientes(flat, id)) {
    if (d.activo) ids.push(d.id);
  }
  return ids;
}

/** Whether a progress row holds data that must be kept when it is archived. */
export function tieneDatosDeAvance(fila: ProgresoFila): boolean {
  return (
    fila.estado === 'cubierta' ||
    (fila.notas ?? '').trim() !== '' ||
    fila.repasos > 0 ||
    fila.comentarios > 0 ||
    fila.clases > 0
  );
}

/**
 * Summary of the materias about to be removed from the subset:
 * `total` distinct ids and how many of them have progress data (`conAvance`).
 */
export function resumenDeQuitar(
  progreso: ProgresoFila[],
  quitar: string[],
): { conAvance: number; total: number } {
  const ids = new Set(quitar);
  const filaPorMateria = new Map<string, ProgresoFila>();
  for (const fila of progreso) filaPorMateria.set(fila.materiaId, fila);

  let conAvance = 0;
  for (const id of ids) {
    const fila = filaPorMateria.get(id);
    if (fila && tieneDatosDeAvance(fila)) conAvance += 1;
  }
  return { conAvance, total: ids.size };
}
