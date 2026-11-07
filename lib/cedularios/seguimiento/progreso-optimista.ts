/**
 * Optimistic updates of the progress list of an assignment.
 * Pure module: no React, no Supabase.
 *
 * The desired state is always absolute (never a toggle), so applying it twice
 * gives the same result and a queue of operations on the same row converges to
 * the last state requested.
 */

import type { Cobertura, ProgresoFila } from './tipos';

/**
 * Returns a new list where only the row `progresoId` has the desired coverage.
 * - 'pendiente' clears the date.
 * - 'cubierta' uses `fecha` when given, keeps the current date when the row was
 *   already covered, and falls back to `hoy` otherwise (same rule as the RPC).
 * An unknown id returns the list unchanged. The input list is never mutated.
 */
export function aplicarEstadoOptimista(
  filas: ProgresoFila[],
  progresoId: string,
  estado: Cobertura,
  fecha: string | null,
  hoy: string,
): ProgresoFila[] {
  return filas.map((fila) => {
    if (fila.id !== progresoId) return fila;
    if (estado === 'pendiente') {
      return { ...fila, estado: 'pendiente', fechaCubierta: null };
    }
    const fechaFinal = fecha ?? (fila.estado === 'cubierta' ? fila.fechaCubierta : null) ?? hoy;
    return { ...fila, estado: 'cubierta', fechaCubierta: fechaFinal };
  });
}

/**
 * Puts `previa` back in place of the row with the same id, leaving every other
 * row untouched. An id that is no longer in the list returns the list unchanged.
 */
export function restaurarFila(filas: ProgresoFila[], previa: ProgresoFila): ProgresoFila[] {
  return filas.map((fila) => (fila.id === previa.id ? previa : fila));
}
