// Navegación: destino de retorno de la vista de gestión, control de navegación
// al usuario creado, y formato de fecha de creación.

import { format } from 'date-fns';

export type RutaOrigen = '/admin/profesores' | '/admin/alumnos';

const ORIGENES_VALIDOS: RutaOrigen[] = ['/admin/profesores', '/admin/alumnos'];
const FALLBACK_ADMIN: RutaOrigen = '/admin/profesores';
const DESTINO_PROFESOR = '/profesor/mis-alumnos';

/**
 * Destino del control de retorno de la Vista_Gestion_Enlaces.
 * - profesor -> siempre `/profesor/mis-alumnos` (ignora `from`).
 * - admin -> `from` si es una ruta de origen válida; fallback `/admin/profesores`.
 */
export function destinoRetorno(rol: string, from: string | null | undefined): string {
  if (rol === 'profesor') return DESTINO_PROFESOR;
  if (from && (ORIGENES_VALIDOS as string[]).includes(from)) return from;
  return FALLBACK_ADMIN;
}

export interface EnlaceParaNavegacion {
  tipo: string;
  usuario_creado: string | null;
  usuarioActivo: boolean;
  usuarioExiste: boolean;
}

/**
 * Ruta de navegación al usuario creado con un enlace usado:
 * - alumno activo -> `/admin/alumnos/[id]`
 * - lector activo -> `/admin/alumnos/[id]` (el lector aparece en la lista de alumnos del admin)
 * - profesor activo -> `/admin/profesores/[id]/horarios`
 * - cuenta desactivada o perfil inexistente -> `null`
 */
export function controlNavegacionUsuario(enlace: EnlaceParaNavegacion): string | null {
  if (!enlace.usuario_creado || !enlace.usuarioExiste || !enlace.usuarioActivo) {
    return null;
  }
  if (enlace.tipo === 'alumno' || enlace.tipo === 'lector') return `/admin/alumnos/${enlace.usuario_creado}`;
  if (enlace.tipo === 'profesor') return `/admin/profesores/${enlace.usuario_creado}/horarios`;
  return null;
}

/**
 * Formatea la fecha de creación con día, mes, año, hora y minuto: `dd/MM/yyyy HH:mm`.
 */
export function formatearFechaCreacion(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return format(d, 'dd/MM/yyyy HH:mm');
}
