/**
 * React Query keys and cache policy of the per-student tracking (phase 2).
 * Pure module: no React, no Supabase.
 *
 * Every key starts with `['cedularios', 'seguimiento']`, so invalidating the
 * phase 1 root (`cedulariosKeys.all`) also reaches these queries.
 */

const RAIZ = ['cedularios', 'seguimiento'] as const;

export const seguimientoKeys = {
  all: RAIZ,
  /** Prefix of every student summary (hover, record, selector, header). */
  resumenes: () => [...RAIZ, 'resumen'] as const,
  resumen: (alumnoId: string) => [...RAIZ, 'resumen', alumnoId] as const,
  /** Prefix of the student lists of every cedulario. */
  alumnosTodos: () => [...RAIZ, 'alumnos'] as const,
  /** Student list of one cedulario. Prefix `[..., 'alumnos', cedularioId]` matches every search. */
  alumnos: (cedularioId: string, q: string = '') => [...RAIZ, 'alumnos', cedularioId, q] as const,
  progreso: (asignacionId: string) => [...RAIZ, 'progreso', asignacionId] as const,
  /** Detail (comments, reviews, linked classes) of one progress row. */
  detalle: (progresoId: string) => [...RAIZ, 'detalle', progresoId] as const,
  inactivas: (asignacionId: string) => [...RAIZ, 'inactivas', asignacionId] as const,
  actividad: (asignacionId: string) => [...RAIZ, 'actividad', asignacionId] as const,
  /** Students that can receive the cedulario. */
  asignables: (cedularioId: string, q: string = '') =>
    [...RAIZ, 'asignables', cedularioId, q] as const,
  /** Classes of the student that can be linked to a materia. */
  vinculables: (asignacionId: string, q: string = '') =>
    [...RAIZ, 'vinculables', asignacionId, q] as const,
} as const;

/** Mutation scope id: mutations of one progress row run serially, in order. */
export const scopeProgreso = (progresoId: string): string => `seg-progreso-${progresoId}`;

const SEGUNDO_MS = 1000;

/** `staleTime` per data type, in milliseconds. */
export const SEG_STALE_TIME = {
  resumen: 60 * SEGUNDO_MS,
  alumnos: 60 * SEGUNDO_MS,
  progreso: 30 * SEGUNDO_MS,
  detalle: 30 * SEGUNDO_MS,
  inactivas: 30 * SEGUNDO_MS,
  actividad: 30 * SEGUNDO_MS,
  asignables: 30 * SEGUNDO_MS,
  vinculables: 30 * SEGUNDO_MS,
} as const;

export type SegStaleTimeKey = keyof typeof SEG_STALE_TIME;
