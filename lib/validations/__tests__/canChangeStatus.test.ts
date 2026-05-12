import { describe, it, expect } from 'vitest';

/**
 * UI state logic for attendance status change control.
 * Extracted from HorarioDetailView:
 *   const canChangeStatus = !yaPaso && clase.estado !== 'cambiado'
 *
 * Validates: Requirements 7.1, 7.2, 2.3
 */
function canChangeStatus(yaPaso: boolean, estado: string): boolean {
  return !yaPaso && estado !== 'cambiado';
}

describe('canChangeStatus - UI state logic', () => {
  it('returns false when yaPaso is true (regardless of estado)', () => {
    expect(canChangeStatus(true, 'pendiente')).toBe(false);
    expect(canChangeStatus(true, 'confirmado')).toBe(false);
    expect(canChangeStatus(true, 'cancelado')).toBe(false);
    expect(canChangeStatus(true, 'cambiado')).toBe(false);
    expect(canChangeStatus(true, 'no_asistio')).toBe(false);
  });

  it('returns true when yaPaso is false and estado is not cambiado', () => {
    expect(canChangeStatus(false, 'pendiente')).toBe(true);
    expect(canChangeStatus(false, 'confirmado')).toBe(true);
    expect(canChangeStatus(false, 'cancelado')).toBe(true);
    expect(canChangeStatus(false, 'no_asistio')).toBe(true);
  });

  it('returns false when estado is cambiado (regardless of yaPaso)', () => {
    expect(canChangeStatus(true, 'cambiado')).toBe(false);
    expect(canChangeStatus(false, 'cambiado')).toBe(false);
  });
});
