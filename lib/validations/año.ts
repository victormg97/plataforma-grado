/**
 * Validación compartida cliente/servidor para campos de año académico.
 *
 * Reglas:
 *  - El campo es opcional: vacío/null/undefined siempre es válido.
 *  - Si tiene valor debe ser un entero de 4 dígitos entre ANIO_MIN y ANIO_MAX.
 *  - ANIO_MAX = año actual + 10 (permite informar año de egreso futuro).
 */

export const ANIO_MIN = 1900;
// Calculado en tiempo de módulo. En el servidor se recalcula en cada import,
// en el cliente se fija al cargar la página — suficiente para la validación.
export const ANIO_MAX = new Date().getFullYear() + 10;

export interface ResultadoAño {
  valido: boolean;
  /** Valor numérico parseado (solo si valido === true y el input no era vacío). */
  valor?: number;
  /** Mensaje de error listo para mostrar. */
  mensaje?: string;
}

/**
 * Valida un campo de año académico.
 *
 * @param raw  Valor crudo del input (string) o null/undefined para "vacío".
 * @returns    `{ valido: true, valor? }` o `{ valido: false, mensaje }`.
 */
export function validarAño(raw: string | null | undefined): ResultadoAño {
  // Vacío → válido (campo opcional)
  if (raw == null || raw.toString().trim() === '') {
    return { valido: true };
  }

  const str = raw.toString().trim();

  // Solo dígitos
  if (!/^\d+$/.test(str)) {
    return { valido: false, mensaje: 'El año debe contener solo dígitos' };
  }

  // Exactamente 4 dígitos
  if (str.length !== 4) {
    return { valido: false, mensaje: 'El año debe tener exactamente 4 dígitos' };
  }

  const num = parseInt(str, 10);

  if (num < ANIO_MIN || num > ANIO_MAX) {
    return {
      valido: false,
      mensaje: `El año debe estar entre ${ANIO_MIN} y ${ANIO_MAX}`,
    };
  }

  return { valido: true, valor: num };
}
