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
  /** Pre-computed by the API using server time. True when now >= classStart - deadlineHours. */
  plazoVencido: boolean;
  /** Hours before class start after which changes are blocked. 0 = block at class start (default). */
  cancellationDeadlineHours: number;
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
  const { userRol, newEstado, claseTerminada, solicitudAceptada, plazoVencido } = params;

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

  // b. Plazo vencido bloquea cualquier cambio (antes de verificar si la clase terminó)
  if (plazoVencido) {
    return {
      allowed: false,
      errorMessage: 'El plazo para modificar la asistencia ha vencido.',
      httpStatus: 403,
    };
  }

  // c. Clase terminada bloquea cualquier cambio
  if (claseTerminada) {
    return {
      allowed: false,
      errorMessage: 'La clase ya finalizó. Solo un profesor puede modificar el estado.',
      httpStatus: 403,
    };
  }

  // d. Solo estados permitidos para alumno
  if (!ALUMNO_ALLOWED_ESTADOS.includes(newEstado)) {
    return {
      allowed: false,
      errorMessage: "Solo puedes seleccionar 'confirmado' o 'cancelado'",
      httpStatus: 403,
    };
  }

  // e. Todo OK
  return { allowed: true };
}

/**
 * Pure helper to validate cancellation_deadline_hours range.
 * Used by PATCH /api/perfil and extractable for testing.
 */
export function isValidCancellationDeadline(val: number): boolean {
  return Number.isInteger(val) && val >= 0 && val <= 168;
}
