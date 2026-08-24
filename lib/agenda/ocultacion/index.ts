/**
 * `Punto_Entrada_Slice` del slice `ocultacion` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Esquemas Zod ───────────────────────────────────────────────────────────
export { ocultarActividadSchema, type OcultarActividad } from './esquemas';

// ─── Servicio (servidor) ────────────────────────────────────────────────────
export { ocultarActividad, mostrarActividad } from './servicio';

// ─── Consulta (servidor y cliente) ──────────────────────────────────────────
export { leerActividadesOcultas, type ActividadOculta } from './consulta';

// ─── Hook de datos (cliente) ────────────────────────────────────────────────
export { useActividadesOcultas } from './hooks/useActividadesOcultas';
