/**
 * `Punto_Entrada_Slice` del slice `entradas-personales` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Esquemas Zod ───────────────────────────────────────────────────────────
export {
  crearEntradaPersonalSchema,
  editarEntradaPersonalSchema,
} from './esquemas';

export type {
  CrearEntradaPersonal,
  EditarEntradaPersonal,
} from './esquemas';

// ─── Servicios ──────────────────────────────────────────────────────────────
export { crearEntradaPersonal } from './servicio.crear';
export { editarEntradaPersonal } from './servicio.editar';
export { eliminarEntradaPersonal } from './servicio.eliminar';
