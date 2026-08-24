/**
 * Slice `nucleo` — claves de React Query de la agenda (Requisitos 17.1, 17.2, 17.3).
 *
 * Patrón: el primer segmento es el nombre del recurso (`'agenda-eventos'`), siguiendo
 * la convención existente del proyecto (`['horarios', targetId]`, `['bloqueos', id]`).
 *
 * Regla de invalidación: una escritura invalida por prefijo (`todosLosRangos`), nunca
 * por rango exacto (un evento arrastrado de un rango a otro afectaría a dos claves).
 */
import type { RangoVisible } from './tipos';

export const clavesAgenda = {
  /** Clave completa para un rango específico de un usuario. */
  eventos: (usuarioId: string, rango: RangoVisible) =>
    ['agenda-eventos', usuarioId, rango.desde, rango.hasta] as const,

  /** Clave para un evento individual. */
  evento: (eventoId: string) => ['agenda-evento', eventoId] as const,

  /** Prefijo para invalidar todos los rangos de un usuario de una vez. */
  todosLosRangos: (usuarioId: string) => ['agenda-eventos', usuarioId] as const,
};
