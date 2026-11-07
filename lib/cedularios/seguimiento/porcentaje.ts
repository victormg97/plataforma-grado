/**
 * Progress percentage of the tracking.
 * Pure module: no React, no Supabase.
 */

/**
 * Rounded percentage (0 to 100, .5 rounds up) of covered over total assigned materias.
 * Returns null when there is nothing assigned, so callers never show NaN, Infinity or 0 %.
 * Matches `round(100.0 * cubiertas / total)` of Postgres for non-negative values.
 */
export function calcularPorcentaje(cubiertas: number, total: number): number | null {
  if (!Number.isFinite(cubiertas) || !Number.isFinite(total) || total <= 0) return null;
  const porcentaje = Math.floor((100 * cubiertas) / total + 0.5);
  return Math.min(100, Math.max(0, porcentaje));
}

/** Text of a percentage: an em dash when null, otherwise 'NN %'. */
export function formatearPorcentaje(p: number | null): string {
  return p === null ? '\u2014' : `${p} %`;
}

/** Whether the progress is complete (100 %). */
export const esAvanceCompleto = (p: number | null): boolean => p === 100;
