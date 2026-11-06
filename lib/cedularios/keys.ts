/**
 * React Query key factory and cache policy for the cedularios module.
 * Every key starts with the `['cedularios']` root, so
 * `invalidateQueries({ queryKey: cedulariosKeys.all })` clears the module.
 */

export type EnlaceScope = 'cedulario' | 'materia';

/** Serializable historial filters (tabla, usuario, date range). */
export type HistorialFiltrosKey = Readonly<Record<string, string | number | boolean | null | undefined>>;

const RAIZ = ['cedularios'] as const;

export const cedulariosKeys = {
  all: RAIZ,
  universidades: () => [...RAIZ, 'universidades'] as const,
  lista: () => [...RAIZ, 'lista'] as const,
  detalle: (cedularioId: string) => [...RAIZ, 'detalle', cedularioId] as const,
  materias: (cedularioId: string) => [...RAIZ, 'materias', cedularioId] as const,
  materia: (materiaId: string) => [...RAIZ, 'materia', materiaId] as const,
  /** `parentId` is the cedulario id or the materia id, depending on `scope`. */
  enlaces: (scope: EnlaceScope, parentId: string) => [...RAIZ, 'enlaces', scope, parentId] as const,
  permisos: (cedularioId: string) => [...RAIZ, 'permisos', cedularioId] as const,
  /** Creator of a cedulario (never changes, so no Realtime invalidation). */
  creador: (cedularioId: string) => [...RAIZ, 'creador', cedularioId] as const,
  historial: (cedularioId: string, filtros: HistorialFiltrosKey = {}) =>
    [...RAIZ, 'historial', cedularioId, filtros] as const,
} as const;

const SEGUNDO_MS = 1000;
const MINUTO_MS = 60 * SEGUNDO_MS;

/** `staleTime` per data type, in milliseconds. */
export const STALE_TIME = {
  /** universidades and the cedulario list (Req 16.5) */
  universidades: 5 * MINUTO_MS,
  lista: 5 * MINUTO_MS,
  detalle: 60 * SEGUNDO_MS,
  /** materia structure (flat tree) */
  estructura: 60 * SEGUNDO_MS,
  materia: 60 * SEGUNDO_MS,
  enlaces: 60 * SEGUNDO_MS,
  permisos: 60 * SEGUNDO_MS,
  historial: 30 * SEGUNDO_MS,
} as const;

export type StaleTimeKey = keyof typeof STALE_TIME;
