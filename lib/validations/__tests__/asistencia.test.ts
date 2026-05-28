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
   * solicitudAceptada = false, plazoVencido = false, userRol = 'alumno':
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
            plazoVencido: false,
            cancellationDeadlineHours: 0,
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
   * userRol = 'alumno', solicitudAceptada = false, plazoVencido = false:
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
            plazoVencido: false,
            cancellationDeadlineHours: 0,
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
   * any solicitudAceptada, any plazoVencido:
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
        fc.boolean(),
        fc.integer({ min: 0, max: 168 }),
        (userRol, currentEstado, newEstado, claseTerminada, solicitudAceptada, plazoVencido, cancellationDeadlineHours) => {
          const result = validateEstadoChange({
            userRol,
            currentEstado,
            newEstado,
            claseTerminada,
            solicitudAceptada,
            plazoVencido,
            cancellationDeadlineHours,
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
   * claseTerminada = false, userRol = 'alumno', solicitudAceptada = false,
   * plazoVencido = false:
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
            plazoVencido: false,
            cancellationDeadlineHours: 0,
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
   */
  it('Property 5: Confirming attendance is allowed (prerequisite for auto-cancel of pending solicitud)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALUMNO_CURRENT_ESTADOS),
        (currentEstado) => {
          const result = validateEstadoChange({
            userRol: 'alumno',
            currentEstado,
            newEstado: 'confirmado',
            claseTerminada: false,
            solicitudAceptada: false,
            plazoVencido: false,
            cancellationDeadlineHours: 0,
          });

          expect(result).toEqual({ allowed: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Accepted solicitud blocks alumno state changes
   * Validates: Requirements 6.2
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
            plazoVencido: false,
            cancellationDeadlineHours: 0,
          });

          expect(result.allowed).toBe(false);
          expect(result.httpStatus).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });
});
