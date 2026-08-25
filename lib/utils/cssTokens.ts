/**
 * cssTokens.ts
 * Single source of truth: reads CSS custom properties from globals.css at runtime.
 * All colour values in the app live in globals.css — never duplicate hex here.
 */

/**
 * Reads a CSS custom property from the document root at call time.
 * Returns the trimmed value (e.g. "#C9993F", "rgb(45, 106, 79)").
 * Falls back to `fallback` when called server-side or the property is empty.
 */
export function resolveCssVar(name: string, fallback = '#000000'): string {
  if (typeof document === 'undefined') return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/**
 * Same as resolveCssVar but temporarily removes the `.dark` class from <html>
 * before reading, so you always get the light-mode value — useful for PDF export
 * where you always want a light, print-friendly palette.
 * The DOM change is synchronous (no browser repaint happens between the two operations).
 */
export function resolveCssVarLight(name: string, fallback = '#000000'): string {
  if (typeof document === 'undefined') return fallback;
  const root = document.documentElement;
  const hadDark = root.classList.contains('dark');
  if (hadDark) root.classList.remove('dark');
  const val = getComputedStyle(root).getPropertyValue(name).trim();
  if (hadDark) root.classList.add('dark');
  return val || fallback;
}

/**
 * Parses a CSS colour string (hex 3/6 digit, rgb(), rgba()) to an [R, G, B] tuple.
 * Returns [0, 0, 0] if the string cannot be parsed.
 */
export function parseColorToRgb(css: string): [number, number, number] {
  const s = css.trim();

  // Hex #RGB or #RRGGBB
  if (s.startsWith('#')) {
    const clean = s.replace('#', '');
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }

  // rgb() / rgba()
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];

  return [0, 0, 0];
}

/**
 * Resolves a CSS custom property and parses it to an [R, G, B] tuple.
 * Uses light-mode values — intended for PDF generation.
 */
export function resolveCssVarToRgb(
  name: string,
  fallback = '#000000',
): [number, number, number] {
  return parseColorToRgb(resolveCssVarLight(name, fallback));
}

/**
 * Returns a legible text color (white or dark) for the given background color.
 * Uses WCAG relative luminance to decide contrast.
 *
 * Accepts:
 * - Hex values: "#C9993F", "#fff"
 * - CSS variable references: "var(--color-brand-gold)" or "var(--color-brand-gold, #C9993F)"
 * - rgb()/rgba() strings
 *
 * When given a CSS variable, it resolves the value at runtime via getComputedStyle.
 * Falls back to white text if the color cannot be parsed (safe for dark backgrounds).
 */
export function getContrastTextColor(color: string): string {
  let resolved = color.trim();

  // If it's a CSS variable reference, resolve it
  const varMatch = resolved.match(/^var\(\s*(--[^,)]+)(?:,\s*([^)]+))?\s*\)$/);
  if (varMatch) {
    const [, varName, fallback] = varMatch;
    resolved = resolveCssVar(varName, fallback?.trim() || '#000000');
  }

  const [r, g, b] = parseColorToRgb(resolved);

  // Relative luminance (simplified linear — sufficient for contrast decision)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.45 ? '#1a1a1a' : '#FFFFFF';
}
