/**
 * Constants of the per-student cedulario tracking (phase 2).
 * Pure module: no React, no Supabase.
 */

/**
 * Platform time zone used to decide what "today" means.
 * Mirror of `seguimiento_hoy()` in SQL (migration 154): both must change together.
 */
export const PLATFORM_TIMEZONE = 'America/Santiago';

/** Maximum length of the note stored in a progress row. */
export const MAX_NOTA = 2000;

/** Maximum length of a comment (after trimming). */
export const MAX_COMENTARIO = 1000;

/** Maximum length of the note of a review (repaso). */
export const MAX_REPASO_NOTA = 500;

/** Maximum number of students accepted by one assignment operation. */
export const MAX_ALUMNOS_POR_ASIGNACION = 200;

/** Maximum number of cedularios accepted by one multi-cedulario assignment operation. */
export const MAX_CEDULARIOS_POR_ASIGNACION = 50;

/** Students sent per RPC call, so large cedularios stay under the statement timeout. */
export const ALUMNOS_POR_LLAMADA = 25;

/** Visible rows above which the tree switches to a virtualized list. */
export const UMBRAL_VIRTUALIZACION_FILAS = 100;

/** Extra rows rendered above and below the viewport in the virtualized list. */
export const OVERSCAN_FILAS = 20;

/** Height in pixels of one tree row. */
export const ALTURA_FILA = 44;

/** Maximum length of the tree search text. Same value as the phase 1 search. */
export const SEG_BUSQUEDA_MAX = 100;

/** Debounce in milliseconds of the tree search. Same value as the phase 1 search. */
export const SEG_BUSQUEDA_DEBOUNCE_MS = 300;
