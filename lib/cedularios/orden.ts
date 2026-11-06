/**
 * Gapped integer ordering for siblings (decision D-6).
 *
 * Pure TypeScript. Mirrors the SQL side: an `orden` of 0 on insert means "append"
 * (highest active sibling + 1024, or 1024 when there are no siblings), and
 * `mover_materia` places a row at the floor-midpoint of its two neighbors, falling
 * back to a rebalance (siblings renumbered at multiples of 1024) when no integer fits.
 */

export const ORDEN_PASO = 1024;

function compararOrdenId(a: { id: string; orden: number }, b: { id: string; orden: number }): number {
  if (a.orden !== b.orden) return a.orden < b.orden ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** `orden` for a row appended after all `hermanos`: highest orden + ORDEN_PASO, or ORDEN_PASO when empty. */
export function ordenAlFinal(hermanos: { orden: number }[]): number {
  if (hermanos.length === 0) return ORDEN_PASO;
  let max = hermanos[0].orden;
  for (const h of hermanos) {
    if (h.orden > max) max = h.orden;
  }
  return max + ORDEN_PASO;
}

/**
 * `orden` for a row placed between two neighbors (`null` = no neighbor on that side).
 * - no neighbors: ORDEN_PASO
 * - first position (`prev` null): next - ORDEN_PASO
 * - last position (`next` null): prev + ORDEN_PASO
 * - both: floor((prev + next) / 2) when an integer fits strictly between them, otherwise
 *   `{ tipo: 'rebalancear' }`.
 */
export function ordenEntre(
  prev: number | null,
  next: number | null,
): { tipo: 'valor'; orden: number } | { tipo: 'rebalancear' } {
  if (prev === null && next === null) return { tipo: 'valor', orden: ORDEN_PASO };
  if (prev === null) return { tipo: 'valor', orden: (next as number) - ORDEN_PASO };
  if (next === null) return { tipo: 'valor', orden: prev + ORDEN_PASO };
  if (next - prev < 2) return { tipo: 'rebalancear' };
  return { tipo: 'valor', orden: Math.floor((prev + next) / 2) };
}

/**
 * Renumbers siblings at multiples of ORDEN_PASO (1024, 2048, ...), keeping their relative
 * order, which is ascending (orden, id). Returns new objects; the input is not mutated.
 */
export function rebalancear<T extends { id: string; orden: number }>(hermanos: T[]): T[] {
  return [...hermanos]
    .sort(compararOrdenId)
    .map((h, i) => ({ ...h, orden: (i + 1) * ORDEN_PASO }));
}
