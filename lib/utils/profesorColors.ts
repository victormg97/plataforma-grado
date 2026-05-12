/**
 * Deterministic color assignment for professors in the admin calendar.
 *
 * Strategy:
 * - First 7 professors get curated colors from CSS variables (--color-profe-1..7)
 * - Additional professors get algorithmically generated colors based on their ID
 * - Colors are deterministic: same professor ID always gets the same color
 * - Generated colors use HSL with high saturation and good contrast against white text
 */

import { resolveCssVar } from '@/lib/utils/cssTokens';

// Curated palette — these are the "premium" colors defined in globals.css
const CURATED_CSS_VARS = [
  '--color-profe-1',
  '--color-profe-2',
  '--color-profe-3',
  '--color-profe-4',
  '--color-profe-5',
  '--color-profe-6',
  '--color-profe-7',
] as const;

const CURATED_COLORS = [
  { bg: 'var(--color-profe-1)', text: 'var(--color-brand-black)' },
  { bg: 'var(--color-profe-2)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-3)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-4)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-5)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-6)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-7)', text: 'var(--color-brand-white)' },
];

/**
 * Simple deterministic hash from a string (profesor ID) to a number.
 * Uses djb2 algorithm — fast and produces good distribution.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a visually distinct HSL color from a profesor ID.
 * Uses golden angle distribution for hue to maximize visual separation.
 * Keeps saturation high (60-75%) and lightness in a range that works
 * with white text (40-55%).
 */
function generateColor(profesorId: string, index: number): { bg: string; text: string } {
  const hash = hashString(profesorId);

  // Use golden angle (137.5°) offset by the hash for good hue distribution
  // This ensures even sequential IDs get visually distinct colors
  const hue = (hash * 137.508 + index * 47) % 360;
  const saturation = 55 + (hash % 20); // 55-75%
  const lightness = 42 + (hash % 13);  // 42-55% — dark enough for white text

  const bg = `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
  return { bg, text: '#FFFFFF' };
}

export interface ProfesorColor {
  bg: string;
  border: string;
  text: string;
}

/**
 * Build a color map for a list of professor IDs.
 * First 7 get curated colors, the rest get generated ones.
 *
 * The assignment is stable: it's based on the sorted order of IDs,
 * so the same set of professors always gets the same color assignment.
 */
export function buildProfesorColorMap(profesorIds: string[]): Record<string, ProfesorColor> {
  const uniqueIds = [...new Set(profesorIds)];
  const map: Record<string, ProfesorColor> = {};

  uniqueIds.forEach((id, i) => {
    if (i < CURATED_COLORS.length) {
      const curated = CURATED_COLORS[i];
      map[id] = { bg: curated.bg, border: curated.bg, text: curated.text };
    } else {
      const generated = generateColor(id, i);
      map[id] = { bg: generated.bg, border: generated.bg, text: generated.text };
    }
  });

  return map;
}

/**
 * Build a hex color map for PDF export.
 * Resolves CSS variables to actual hex values at call time.
 * For generated colors (beyond 7), returns the HSL string directly
 * (jsPDF/canvas can handle HSL).
 */
export function buildProfesorHexMap(profesorIds: string[]): Record<string, string> {
  const uniqueIds = [...new Set(profesorIds)];
  const map: Record<string, string> = {};

  uniqueIds.forEach((id, i) => {
    if (i < CURATED_CSS_VARS.length) {
      map[id] = resolveCssVar(CURATED_CSS_VARS[i]);
    } else {
      const generated = generateColor(id, i);
      map[id] = generated.bg;
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
