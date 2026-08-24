/**
 * `Punto_Entrada_Slice` del slice `nucleo` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────
export type {
  AutorResumen,
  EventoAgendaAjeno,
  EventoAgendaBase,
  EventoAgendaPropio,
  EventoAgendaProyectado,
  RangoVisible,
  TipoElementoAgenda,
  TipoEventoAgenda,
  AdvertenciaSolapamiento,
  RespuestaEscrituraAgenda,
  ErrorAgendaBody,
} from './tipos';

export type { CamposEscrituraAgenda } from './mapeo';

// ─── Esquemas Zod ───────────────────────────────────────────────────────────
export {
  tituloAgenda,
  fechaAgenda,
  horaAgenda,
  categoriaAgenda,
  visibilidadAgenda,
  lugarAgenda,
  descripcionAgenda,
  notaAgenda,
} from './esquemas';

// ─── Mapeo Row <-> DTO ──────────────────────────────────────────────────────
export {
  aEventoAgendaPropio,
  aEventoAgendaAjeno,
  aFilaEventoAgenda,
  tipoDesdeAlcance,
} from './mapeo';
export type {
  FilaEventoAgenda,
  FilaEventoAgendaSinTextoLibre,
  ContextoEventoAgenda,
} from './mapeo';

// ─── Claves de React Query ──────────────────────────────────────────────────
export { clavesAgenda } from './claves';

// ─── Repositorio (servidor — solo usa import type de server) ────────────────
export { leerEventoPorId, desactivarEvento } from './repositorio';
export type { FilaEventoConAutor } from './repositorio';
export { leerEventosEnRango } from './repositorio.rango';

// ─── Hook de datos (cliente) ────────────────────────────────────────────────
export { useEventosAgenda } from './hooks/useEventosAgenda';
