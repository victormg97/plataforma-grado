/**
 * Color assignment for professors in the admin calendar.
 *
 * Strategy:
 * 1. If a professor has a stored color (color_calendario), use it.
 * 2. Otherwise, fall back to a brand default color.
 *
 * The fallback color is --color-brand-gold (resolved at runtime) so that
 * professors without a custom color get the tenant's brand color by default.
 */

import { resolveCssVar, getContrastTextColor } from '@/lib/utils/cssTokens';

/** Default brand color used for professors who haven't chosen a custom color. */
const DEFAULT_COLOR_VAR = '--color-brand-gold';

export interface ProfesorColor {
  bg: string;
  border: string;
  text: string;
}

/**
 * Build a color map for a list of professor IDs using their stored colors.
 *
 * @param profesorIds - All professor IDs present in the horarios
 * @param storedColors - Map of profesorId → stored hex color (from DB)
 */
export function buildProfesorColorMap(
  profesorIds: string[],
  storedColors?: Record<string, string | null>
): Record<string, ProfesorColor> {
  const uniqueIds = [...new Set(profesorIds)];
  const map: Record<string, ProfesorColor> = {};
  const defaultBg = `var(${DEFAULT_COLOR_VAR})`;

  uniqueIds.forEach((id) => {
    const stored = storedColors?.[id];
    if (stored) {
      // Professor chose a custom color
      const text = getContrastTextColor(stored);
      map[id] = { bg: stored, border: stored, text };
    } else {
      // No custom color: use brand color — compute contrast text dynamically
      const text = getContrastTextColor(`var(${DEFAULT_COLOR_VAR})`);
      map[id] = { bg: defaultBg, border: defaultBg, text };
    }
  });

  return map;
}

/**
 * Build a hex color map for PDF export.
 * Resolves CSS variables to actual hex values at call time.
 *
 * @param profesorIds - All professor IDs
 * @param storedColors - Map of profesorId → stored hex color
 */
export function buildProfesorHexMap(
  profesorIds: string[],
  storedColors?: Record<string, string | null>
): Record<string, string> {
  const uniqueIds = [...new Set(profesorIds)];
  const map: Record<string, string> = {};

  uniqueIds.forEach((id) => {
    const stored = storedColors?.[id];
    if (stored) {
      map[id] = stored;
    } else {
      map[id] = resolveCssVar(DEFAULT_COLOR_VAR);
    }
  });

  return map;
}

/**
 * Get the legend entries (name + color) for display.
 */
export function buildProfesorLegend(
  profesores: { id: string; nombre: string; apellido: string }[],
  colorMap: Record<string, ProfesorColor>
): { nombre: string; color: string }[] {
  return profesores.map((p) => ({
    nombre: `${p.nombre} ${p.apellido}`,
    color: colorMap[p.id]?.bg || 'var(--color-text-muted)',
  }));
}
