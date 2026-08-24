/**
 * Slice `compartido` — utilidades de tiempo sin dominio (Requisitos 17.1, 17.2, 17.3).
 *
 * Nivel 0 del grafo de slices: este archivo NO importa nada, ni del proyecto ni de
 * terceros. Es la única forma de garantizar que cualquier slice pueda depender de él
 * sin crear un ciclo (Requisito 17.4).
 *
 * Postgres devuelve `TIME` como `HH:MM:SS` y la interfaz trabaja con `HH:MM`.
 * `normalizarHora` es el único punto donde se reconcilian los dos formatos: el resto
 * del código de agenda asume `HH:MM` en todo momento.
 */

/** Rango que el Requisito 10.10 asigna a un evento de día completo. */
export const RANGO_DIA_COMPLETO = { hora_inicio: '00:00', hora_fin: '23:59' } as const;

/**
 * `HH:MM`, `H:MM`, `HH:MM:SS` y `HH:MM:SS.mmm` (la forma que puede llegar de
 * Postgres). Los segundos y los milisegundos se descartan: la agenda no los usa.
 */
const FORMA_HORA = /^(\d{1,2}):(\d{1,2})(?::\d{1,2}(?:\.\d+)?)?$/;

const MINUTOS_POR_HORA = 60;
const HORAS_POR_DIA = 24;

function conDosDigitos(valor: number): string {
  return valor < 10 ? `0${valor}` : String(valor);
}

/**
 * Normaliza una hora a `HH:MM`. `09:00:00` y `9:00` devuelven los dos `09:00`.
 *
 * Cuando el valor no tiene forma de hora o cae fuera de `00:00`–`23:59`, devuelve la
 * cadena recortada **sin cambios** en lugar de lanzar o de inventar un valor: así el
 * dato inválido llega intacto al esquema Zod que lo rechaza, en vez de quedar
 * enmascarado como una hora legítima.
 */
export function normalizarHora(valor: string): string {
  const recortado = valor.trim();
  const partes = FORMA_HORA.exec(recortado);

  if (!partes) return recortado;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);

  if (horas >= HORAS_POR_DIA || minutos >= MINUTOS_POR_HORA) return recortado;

  return `${conDosDigitos(horas)}:${conDosDigitos(minutos)}`;
}

/**
 * Convierte una hora a minutos desde la medianoche. `'23:59' -> 1439`.
 *
 * Base de todas las comparaciones de rango: comparar números evita depender del
 * orden lexicográfico, que falla en cuanto una hora llega sin el cero a la izquierda
 * (`'9:00' > '10:00'` es `true` como texto).
 *
 * Devuelve `NaN` cuando el valor no es una hora válida. Los llamadores comparan
 * rangos ya validados por Zod, así que `NaN` es una señal de dato corrupto y no un
 * caso de uso: propagarlo como `NaN` deja la comparación en `false` de forma
 * observable en lugar de fingir un `00:00`.
 */
export function aMinutos(hora: string): number {
  const normalizada = normalizarHora(hora);
  const partes = FORMA_HORA.exec(normalizada);

  if (!partes) return Number.NaN;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);

  if (horas >= HORAS_POR_DIA || minutos >= MINUTOS_POR_HORA) return Number.NaN;

  return horas * MINUTOS_POR_HORA + minutos;
}

/**
 * Rango legible para los mensajes de conflicto: `formatearRango('9:00', '10:30:00')`
 * devuelve `'09:00–10:30'`.
 *
 * No contiene texto de interfaz (Requisito 15.1): solo las dos horas y un separador.
 * El mensaje que rodea al rango lo resuelve el cliente con next-intl, interpolando
 * esta cadena.
 */
export function formatearRango(
  horaInicio: string,
  horaFin: string,
  separador = '–',
): string {
  return `${normalizarHora(horaInicio)}${separador}${normalizarHora(horaFin)}`;
}
