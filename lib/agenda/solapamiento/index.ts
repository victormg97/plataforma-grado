/**
 * `Punto_Entrada_Slice` del slice `solapamiento` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint configurada en la tarea 2.2.
 *
 * Responsabilidad: el predicado de Solapamiento como función pura, su evaluación
 * contra una lista de elementos, la recolección de esos elementos en el servidor
 * y la construcción de las Advertencias_Solapamiento.
 *
 * Fuera de alcance: no decide si un solapamiento bloquea o solo advierte (eso lo
 * decide el slice de capacidad que lo consume) y no persiste nada.
 */

// ─── Predicado ──────────────────────────────────────────────────────────────
export { seSolapan, rangoEfectivo, type ElementoTemporal, type RangoMinutos } from './predicado';

// ─── Evaluador ──────────────────────────────────────────────────────────────
export { evaluarSolapamiento, LIMITE_CONFLICTOS, LIMITE_ADVERTENCIAS, type OpcionesEvaluar } from './evaluador';

// ─── Mensajes ───────────────────────────────────────────────────────────────
export { aAdvertencia, type ElementoConMeta } from './mensajes';

// ─── Recolector (servidor) ──────────────────────────────────────────────────
export { recolectarCompromisosAlumno, recolectarElementosEditor } from './recolector.servidor';

// ─── Hook (cliente) ─────────────────────────────────────────────────────────
export { useConflictoLocal, type ResultadoConflictoLocal } from './hooks/useConflictoLocal';
