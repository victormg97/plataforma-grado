// Lógica pura de transición de estado, acciones de fila, validación de código
// y resolución del control de navegación al usuario creado.

export type AccionEstado = 'habilitar' | 'deshabilitar';

export type ResultadoTransicion =
  | { ok: true; estado: string }
  | { ok: false; motivo: 'usado_no_reactivable' | 'transicion_invalida'; estado: string };

/**
 * Transición de estado de un enlace:
 * - `activo` + deshabilitar -> `deshabilitado`
 * - `deshabilitado` + habilitar -> `activo`
 * - `usado` + habilitar -> rechazo, conservando `usado`
 * Cualquier otra combinación es una transición inválida que conserva el estado.
 */
export function transicionEstado(
  estado: string,
  accion: AccionEstado,
): ResultadoTransicion {
  if (estado === 'usado') {
    return { ok: false, motivo: 'usado_no_reactivable', estado: 'usado' };
  }
  if (accion === 'deshabilitar' && estado === 'activo') {
    return { ok: true, estado: 'deshabilitado' };
  }
  if (accion === 'habilitar' && estado === 'deshabilitado') {
    return { ok: true, estado: 'activo' };
  }
  return { ok: false, motivo: 'transicion_invalida', estado };
}

export interface EnlaceParaAcciones {
  estado: string;
  tipo: string;
  usuarioCreadoActivo: boolean;
}

export type AccionFila =
  | 'editar'
  | 'compartir'
  | 'deshabilitar'
  | 'habilitar'
  | 'eliminar'
  | 'navegar_usuario';

/**
 * Conjunto de acciones disponibles para una fila, según estado/tipo/rol.
 * - "deshabilitar" si y solo si `activo`; "habilitar" si y solo si `deshabilitado`;
 *   nunca alternar estado si `usado`.
 * - "navegar_usuario" si y solo si `usado` y la cuenta del usuario creado activa.
 * Solo el admin obtiene acciones de mutación (editar/estado/eliminar).
 */
export function accionesDeFila(
  enlace: EnlaceParaAcciones,
  rol: string,
): AccionFila[] {
  const acciones: AccionFila[] = [];
  const esAdmin = rol === 'admin';

  if (enlace.estado === 'usado') {
    if (enlace.usuarioCreadoActivo) acciones.push('navegar_usuario');
    acciones.push('compartir');
    return acciones;
  }

  if (esAdmin && enlace.tipo === 'alumno' && enlace.estado === 'activo') {
    acciones.push('editar');
  }

  acciones.push('compartir');

  if (esAdmin) {
    if (enlace.estado === 'activo') acciones.push('deshabilitar');
    else if (enlace.estado === 'deshabilitado') acciones.push('habilitar');
    acciones.push('eliminar');
  }

  return acciones;
}

export interface EnlaceParaValidar {
  estado: string;
  eliminado: boolean;
}

/**
 * Un código es válido para registro si y solo si el enlace existe, su estado es
 * `activo` y no está eliminado. Cualquier otra combinación es inválida.
 */
export function validarCodigo(
  enlace: EnlaceParaValidar | null | undefined,
): boolean {
  if (!enlace) return false;
  return enlace.estado === 'activo' && enlace.eliminado === false;
}
