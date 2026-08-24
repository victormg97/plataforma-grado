/**
 * Particionamiento de destinatarios en lotes de correo (Requisito 13.9).
 *
 * El Servicio_Correo procesa los destinatarios en Lotes_Correo de como maximo
 * 50 unidades, completando cada lote antes de iniciar el siguiente. La
 * concatenacion de todos los lotes reconstruye la lista original en el mismo
 * orden (propiedad verificable con fast-check).
 */

/** Tamano maximo de un Lote_Correo (Requisito 13.9). */
export const TAMANO_LOTE = 50;

/**
 * Divide un array en sub-arrays de tamano maximo `tamano`, preservando el
 * orden original. La concatenacion de todos los sub-arrays es identica a la
 * lista de entrada.
 *
 * @param items Lista a particionar.
 * @param tamano Tamano maximo de cada lote. Por defecto `TAMANO_LOTE` (50).
 * @returns Array de lotes; vacio si `items` esta vacio.
 */
export function particionarEnLotes<T>(items: T[], tamano = TAMANO_LOTE): T[][] {
  if (items.length === 0) return [];
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano));
  }
  return lotes;
}
