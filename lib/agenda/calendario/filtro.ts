/**
 * Slice `calendario` — estado del Filtro_Agenda (Requisito 12.3).
 *
 * El filtro controla qué tipos de evento son visibles en la interfaz del calendario.
 * Su estado vive en el query param `agenda` y es de presentación pura: no modifica
 * los datos persistidos ni las peticiones al servidor.
 *
 * Serialización: `"cla,per,act"` — cada abreviatura presente indica que ese tipo
 * está activo. Cuando los tres están activos, el param es `null` (no se añade a
 * la URL), lo cual es el default.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface FiltroAgenda {
  clases: boolean;
  entradasPersonales: boolean;
  actividades: boolean;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

export const FILTRO_POR_DEFECTO: FiltroAgenda = {
  clases: true,
  entradasPersonales: true,
  actividades: true,
};

// ─── Mapeo de abreviaturas ──────────────────────────────────────────────────

const ABREV_CLASES = 'cla';
const ABREV_ENTRADAS = 'per';
const ABREV_ACTIVIDADES = 'act';

const ABREVIATURAS_VALIDAS = new Set([ABREV_CLASES, ABREV_ENTRADAS, ABREV_ACTIVIDADES]);

// ─── Funciones ──────────────────────────────────────────────────────────────

/**
 * Parsea el valor del query param `agenda` a un `FiltroAgenda`.
 *
 * - `null` o cadena vacía → filtro por defecto (los tres activos).
 * - Valor corrupto (sin ninguna abreviatura reconocida) → filtro por defecto.
 * - Abreviaturas válidas → solo los tipos listados están activos.
 */
export function parsearFiltro(valor: string | null): FiltroAgenda {
  if (!valor || valor.trim() === '') {
    return FILTRO_POR_DEFECTO;
  }

  const tokens = valor
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => ABREVIATURAS_VALIDAS.has(t));

  // Un valor sin ningún token reconocido cae en el default
  if (tokens.length === 0) {
    return FILTRO_POR_DEFECTO;
  }

  return {
    clases: tokens.includes(ABREV_CLASES),
    entradasPersonales: tokens.includes(ABREV_ENTRADAS),
    actividades: tokens.includes(ABREV_ACTIVIDADES),
  };
}

/**
 * Serializa un `FiltroAgenda` al formato del query param `agenda`.
 *
 * - Si es el filtro por defecto (los tres activos), devuelve `null` para que el
 *   param no aparezca en la URL.
 * - De lo contrario, devuelve la cadena con las abreviaturas de los tipos activos.
 */
export function serializarFiltro(filtro: FiltroAgenda): string | null {
  const esPorDefecto =
    filtro.clases && filtro.entradasPersonales && filtro.actividades;

  if (esPorDefecto) {
    return null;
  }

  const partes: string[] = [];
  if (filtro.clases) partes.push(ABREV_CLASES);
  if (filtro.entradasPersonales) partes.push(ABREV_ENTRADAS);
  if (filtro.actividades) partes.push(ABREV_ACTIVIDADES);

  return partes.join(',');
}
