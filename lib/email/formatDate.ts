/**
 * Utilidad de formateo de fechas para correos transaccionales.
 *
 * Convierte la fecha almacenada en PostgreSQL (formato ISO `YYYY-MM-DD`) al
 * formato legible `DD-MM-YYYY` que los usuarios chilenos esperan ver.
 *
 * Se aplica en el momento de construir las variables del correo (puntos de
 * disparo), de modo que el token `{fecha}` y `{fecha_propuesta}` siempre llegan
 * a la plantilla en formato día-mes-año.
 */

/**
 * Convierte una fecha en formato `YYYY-MM-DD` (ISO, como llega de PostgreSQL)
 * al formato `DD-MM-YYYY`.
 *
 * Si el valor ya viene vacío, nulo o no sigue el patrón esperado, se devuelve
 * tal cual para evitar corromper datos (fail-safe).
 *
 * @param fechaIso Fecha en formato ISO `YYYY-MM-DD` (p.ej. `"2026-07-21"`).
 * @returns Fecha en formato `DD-MM-YYYY` (p.ej. `"21-07-2026"`).
 */
export function formatFechaEmail(fechaIso: string | null | undefined): string {
  if (!fechaIso) return '';

  // Match YYYY-MM-DD pattern
  const match = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fechaIso; // Not ISO format, return as-is

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}
