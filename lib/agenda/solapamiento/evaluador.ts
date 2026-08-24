/**
 * Slice `solapamiento` — evaluador de solapamiento (Requisitos 6.5, 7.3).
 *
 * Función pura, sin efectos, sin acceso a datos, sin estado. Filtra los elementos
 * que solapan con un candidato, ordena por fecha y hora de inicio ascendente
 * (Requisito 7.3) y recorta al límite configurado.
 *
 * Solo puede importar de `compartido` (nivel 0) y de archivos del propio slice.
 */
import { aMinutos } from '@/lib/agenda/compartido';

import { seSolapan, type ElementoTemporal } from './predicado';

/** Máximo de conflictos duros que viajan en un 409 (Requisitos 6.2, 6.7, 6.8). */
export const LIMITE_CONFLICTOS = 10;

/** Máximo de advertencias no bloqueantes que devuelve la API (Requisito 7.3). */
export const LIMITE_ADVERTENCIAS = 20;

/**
 * Opciones del evaluador.
 *
 * `excluirId`: permite excluir el propio evento cuando se edita (Requisito 6.5).
 * `limite`: número máximo de resultados; por defecto `LIMITE_CONFLICTOS`.
 */
export interface OpcionesEvaluar {
  /** Identificador del propio evento a excluir de la evaluación (Requisito 6.5). */
  excluirId?: string;
  /** Máximo de resultados. Default: `LIMITE_CONFLICTOS` (10). */
  limite?: number;
}

/**
 * Evalúa qué elementos de `elementos` solapan con `candidato`.
 *
 * - Excluye el elemento cuyo `id` coincide con `opciones.excluirId` (Requisito 6.5).
 * - Ordena el resultado por fecha ascendente y hora de inicio ascendente (Requisito 7.3).
 * - Recorta al `limite` dado (default `LIMITE_CONFLICTOS = 10`).
 *
 * Devuelve el subconjunto que solapa, para que el llamador decida si bloquea o solo
 * advierte.
 */
export function evaluarSolapamiento<T extends ElementoTemporal>(
  candidato: ElementoTemporal,
  elementos: T[],
  opciones?: OpcionesEvaluar,
): T[] {
  const excluirId = opciones?.excluirId;
  const limite = opciones?.limite ?? LIMITE_CONFLICTOS;

  const conflictos = elementos.filter((elemento) => {
    // Excluir el propio evento en la edición (Requisito 6.5)
    if (excluirId !== undefined && elemento.id === excluirId) return false;

    return seSolapan(candidato, elemento);
  });

  // Ordenar por fecha ascendente, luego por hora_inicio ascendente (Requisito 7.3)
  conflictos.sort((a, b) => {
    const comparacionFecha = a.fecha.localeCompare(b.fecha);
    if (comparacionFecha !== 0) return comparacionFecha;

    return aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio);
  });

  return conflictos.slice(0, limite);
}
