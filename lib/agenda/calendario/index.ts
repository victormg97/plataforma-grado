/**
 * `Punto_Entrada_Slice` del slice `calendario` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Colores ────────────────────────────────────────────────────────────────
export { colorDeCategoria, COLORES_CATEGORIA } from './colores';

// ─── Mapeo a FullCalendar ───────────────────────────────────────────────────
export { aEventoFullCalendar } from './mapeoEventos';
export type { EventoFullCalendarAgenda } from './mapeoEventos';

// ─── Mapeo a exportación PDF ────────────────────────────────────────────────
export { aFilaExportacion } from './mapeoExport';

// ─── Filtro de agenda ───────────────────────────────────────────────────────
export { parsearFiltro, serializarFiltro, FILTRO_POR_DEFECTO } from './filtro';
export type { FiltroAgenda } from './filtro';

// ─── Leyenda ────────────────────────────────────────────────────────────────
export { construirLeyenda } from './leyenda';
export type { EntradaLeyenda } from './leyenda';

// ─── Hook del filtro (client) ───────────────────────────────────────────────
export { useFiltroAgenda } from './hooks/useFiltroAgenda';
