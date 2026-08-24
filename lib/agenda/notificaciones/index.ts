/**
 * `Punto_Entrada_Slice` del slice `notificaciones` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicacion se reexporta desde aqui.
 * Las importaciones directas a archivos internos del slice estan prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Servicio ───────────────────────────────────────────────────────────────
export { notificarActividad } from './servicio';
export type { DestinatarioNotificacion } from './servicio';

// ─── Lotes ──────────────────────────────────────────────────────────────────
export { particionarEnLotes, TAMANO_LOTE } from './lotes';

// ─── Variables ──────────────────────────────────────────────────────────────
export { construirVariables, type VariablesNuevaActividad } from './variables';

// ─── Plantilla (reexportada desde lib/email/templates) ──────────────────────
export { plantilla as plantillaNuevaActividad } from '@/lib/email/templates/nuevaActividad';
