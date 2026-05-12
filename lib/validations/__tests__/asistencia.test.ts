import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateEstadoChange } from '../asistencia';
import type { EstadoAsistencia } from '../asistencia';

const ALL_ESTADOS: EstadoAsistencia[] = [
  'pendiente',
  'confirmado',
  'cancelado',
  'cambiado',
  'no_asistio',
];

const ALUMNO_ALLOWED: EstadoAsistencia[] = ['confirmado', 'cancelado'];
const ALUMNO_FORBIDDEN: EstadoAsistencia[] = ['pendiente', 'cambiado', 'no_asistio'];
const ALUMNO_CURRENT_ESTADOS: EstadoAsistencia[] = ['pendiente', 'confirmado', 'cancelado'];

describe('validateEstadoChange - Property-Based Tests', () => {
  /**
   * Property 1: Alumno valid state transitions before class ends
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.3
   *
   * For any currentEstado ∈ {pendiente, confirmado, cancelado},
   * newEstado ∈ {confirmado, cancelado}, claseTerminada = false,
   * solicitudAceptada = false, userRol = 'alumno':
   * validateEstadoChange returns { allowed: true }
   */
  it('Property 1: Alumno valid state transitions before class ends', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALUMNO_CURRENT_ESTADOS),
        fc.constantFrom(...ALUMNO_ALLOWED),
        (currentEstado, newEstado) => {
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado,
            claseTerminada: false,
            solicitudAceptada: false,
          });

          expect(result).toEqual({ allowed: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Alumno blocked after class ends
   * Validates: Requirements 2.1, 2.2, 5.1, 5.3
   *
   * For any newEstado from full enum, claseTerminada = true,
   * userRol = 'alumno', solicitudAceptada = false:
   * validateEstadoChange returns { allowed: false } with httpStatus: 403
   */
  it('Property 2: Alumno blocked after class ends', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ESTADOS),
        fc.constantFrom(...ALL_ESTADOS),
        (currentEstado, newEstado) => {
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado,
            claseTerminada: true,
            solicitudAceptada: false,
          });

          expect(result.allowed).toBe(false);
          expect(result.httpStatus).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Profesor and Admin unrestricted state changes
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.4
   *
   * For any userRol ∈ {profesor, admin}, any newEstado, any claseTerminada,
   * any solicitudAceptada:
   * validateEstadoChange returns { allowed: true }
   */
  it('Property 3: Profesor and Admin unrestricted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'profesor' | 'admin'>('profesor', 'admin'),
        fc.constantFrom(...ALL_ESTADOS),
        fc.constantFrom(...ALL_ESTADOS),
        fc.boolean(),
        fc.boolean(),
        (userRol, currentEstado, newEstado, claseTerminada, solicitudAceptada) => {
          const result = validateEstadoChange({
            userRol,
            currentEstado,
            newEstado,
            claseTerminada,
            solicitudAceptada,
          });

          expect(result).toEqual({ allowed: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Alumno restricted to confirmado and cancelado
   * Validates: Requirements 4.1, 4.2, 4.3, 5.2
   *
   * For any newEstado ∈ {pendiente, cambiado, no_asistio},
   * claseTerminada = false, userRol = 'alumno', solicitudAceptada = false:
   * validateEstadoChange returns { allowed: false } with httpStatus: 403
   */
  it('Property 4: Alumno restricted to confirmado and cancelado', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALUMNO_CURRENT_ESTADOS),
        fc.constantFrom(...ALUMNO_FORBIDDEN),
        (currentEstado, newEstado) => {
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado,
            claseTerminada: false,
            solicitudAceptada: false,
          });

          expect(result.allowed).toBe(false);
          expect(result.httpStatus).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Confirming attendance auto-cancels pending solicitud
   * Validates: Requirements 6.1
   *
   * The auto-cancel logic is a side effect in the API endpoint (PATCH /api/asistencia/[id]).
   * This test verifies the PREREQUISITE: that the validation layer allows an alumno to
   * confirm attendance (which triggers the auto-cancel in the API).
   *
   * The actual behavior: when userRol = 'alumno' and newEstado = 'confirmado',
   * the API updates all solicitudes_cambio_horario with estado = 'pendiente'
   * for the same alumno_id and horario_original_id, setting their estado to 'rechazada'
   * with motivo_rechazo = 'Cancelada por el alumno al confirmar asistencia'.
   */
  it('Property 5: Confirming attendance is allowed (prerequisite for auto-cancel of pending solicitud)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALUMNO_CURRENT_ESTADOS),
        (currentEstado) => {
          // When an alumno confirms attendance with a pending solicitud (not accepted),
          // the validation must allow it so the API can proceed to auto-cancel the solicitud
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado: 'confirmado',
            claseTerminada: false,
            solicitudAceptada: false, // pending, not accepted
          });

          // The validation allows the confirmation
          expect(result).toEqual({ allowed: true });

          // After this validation passes, the API endpoint handles:
          // 1. Updating asistencia.estado to 'confirmado'
          // 2. Auto-cancelling all pending solicitudes for the same horario
          //    (setting estado='rechazada', motivo_rechazo='Cancelada por el alumno al confirmar asistencia')
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Accepted solicitud blocks alumno state changes
   * Validates: Requirements 6.2
   *
   * For any newEstado ∈ {confirmado, cancelado}, solicitudAceptada = true,
   * userRol = 'alumno', claseTerminada = false:
   * validateEstadoChange returns { allowed: false } with httpStatus: 403
   */
  it('Property 6: Accepted solicitud blocks alumno', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALUMNO_CURRENT_ESTADOS),
        fc.constantFrom(...ALUMNO_ALLOWED),
        (currentEstado, newEstado) => {
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado,
            claseTerminada: false,
            solicitudAceptada: true,
          });

          expect(result.allowed).toBe(false);
          expect(result.httpStatus).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });
});
