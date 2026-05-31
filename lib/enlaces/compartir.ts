// Construcción de la URL pública del enlace de invitación.

/** Ruta base de la vista pública de registro. */
export const RUTA_REGISTRO = 'registro';

/**
 * Construye la URL completa del enlace uniendo la base, la ruta de registro y el
 * código con una única barra de separación, sin barras duplicadas (salvo la del
 * esquema `https://`). Invariante ante barras finales sobrantes en `base` o
 * iniciales en `code`.
 */
export function construirUrlEnlace(base: string, code: string): string {
  const baseLimpia = base.replace(/\/+$/, '');
  const codeLimpio = code.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${baseLimpia}/${RUTA_REGISTRO}/${codeLimpio}`;
}
