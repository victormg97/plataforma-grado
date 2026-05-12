import type { EstadoAsistencia } from '@/lib/supabase/types';

export type { EstadoAsistencia };

/**
 * Estados que un alumno puede seleccionar.
 */
export const ALUMNO_ALLOWED_ESTADOS: EstadoAsistencia[] = ['confirmado', 'cancelado'];

export interface ValidateEstadoChangeParams {
  userRol: 'alumno' | 'profesor' | 'admin';
  currentEstado: EstadoAsistencia;
  newEstado: EstadoAsistencia;
  claseTerminada: boolean;
  solicitudAceptada: boolean;
}

export interface ValidateEstadoChangeResult {
  allowed: boolean;
  errorMessage?: string;
  httpStatus?: number;
}

/**
 * Función pura que valida si un cambio de estado de asistencia es permitido.
 * No tiene side effects — no importa Supabase ni Next.js.
 */
export function validateEstadoChange(params: ValidateEstadoChangeParams): ValidateEstadoChangeResult {
  const { userRol, newEstado, claseTerminada, solicitudAceptada } = params;

  // Profesor y Admin: siempre permitido
  if (userRol === 'profesor' || userRol === 'admin') {
    return { allowed: true };
  }

  // Alumno: verificar restricciones en orden de prioridad

  // a. Solicitud aceptada bloquea cualquier cambio
  if (solicitudAceptada) {
    return {
      allowed: false,
      errorMessage: 'No puedes modificar el estado porque tu solicitud de cambio fue aceptada.',
      httpStatus: 403,
    };
  }

  // b. Clase terminada bloquea cualquier cambio
  if (claseTerminada) {
    return {
      allowed: false,
      errorMessage: 'La clase ya finalizó. Solo un profesor puede modificar el estado.',
      httpStatus: 403,
    };
  }

  // c. Solo estados permitidos para alumno
  if (!ALUMNO_ALLOWED_ESTADOS.includes(newEstado)) {
    return {
      allowed: false,
      errorMessage: "Solo puedes seleccionar 'confirmado' o 'cancelado'",
      httpStatus: 403,
    };
  }

  // d. Todo OK
  return { allowed: true };
}
