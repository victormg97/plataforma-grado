/**
 * `Punto_Entrada_Slice` del slice `actividades` (Requisito 17.3).
 *
 * Todo lo que el slice expone al resto de la aplicación se reexporta desde aquí.
 * Las importaciones directas a archivos internos del slice están prohibidas por
 * la regla ESLint de la tarea 2.2.
 */

// ─── Esquemas Zod ───────────────────────────────────────────────────────────
export {
  crearActividadSchema,
  editarActividadSchema,
} from './esquemas';

export type {
  CrearActividad,
  EditarActividad,
} from './esquemas';

// ─── Servicios ──────────────────────────────────────────────────────────────
export { crearActividad } from './servicio.crear';
export { editarActividad } from './servicio.editar';
export { eliminarActividad } from './servicio.eliminar';

// ─── Destinatarios ──────────────────────────────────────────────────────────
export {
  resolverDestinatariosVigentes,
  type DestinatarioVigente,
} from './destinatarios';

// ─── Campos notificables ────────────────────────────────────────────────────
export {
  CAMPOS_NOTIFICABLES,
  cambiaronCamposNotificables,
} from './campos-notificables';
