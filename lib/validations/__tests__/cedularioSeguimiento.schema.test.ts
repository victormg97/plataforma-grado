import { describe, expect, it } from 'vitest';
import { MAX_CEDULARIOS_POR_ASIGNACION } from '@/lib/cedularios/seguimiento/constants';
import { asignarCedulariosSchema } from '../cedularioSeguimiento.schema';

const alumnoId = '11111111-1111-4111-8111-111111111111';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

describe('asignarCedulariosSchema', () => {
  it('acepta varios cedularios con materias distintas', () => {
    const r = asignarCedulariosSchema.safeParse({
      alumnoId,
      cedularios: [
        { cedularioId: uuid(1), materias: 'todas' },
        { cedularioId: uuid(2), materias: [uuid(10), uuid(11)] },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('acepta hasta el maximo y rechaza pasarse', () => {
    const lista = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ cedularioId: uuid(i + 1), materias: 'todas' as const }));
    expect(
      asignarCedulariosSchema.safeParse({ alumnoId, cedularios: lista(MAX_CEDULARIOS_POR_ASIGNACION) }).success,
    ).toBe(true);
    expect(
      asignarCedulariosSchema.safeParse({ alumnoId, cedularios: lista(MAX_CEDULARIOS_POR_ASIGNACION + 1) })
        .success,
    ).toBe(false);
  });

  it('rechaza lista vacia, duplicados, uuid invalido y materias vacias', () => {
    expect(asignarCedulariosSchema.safeParse({ alumnoId, cedularios: [] }).success).toBe(false);
    expect(
      asignarCedulariosSchema.safeParse({
        alumnoId,
        cedularios: [
          { cedularioId: uuid(1), materias: 'todas' },
          { cedularioId: uuid(1).toUpperCase(), materias: 'todas' },
        ],
      }).success,
    ).toBe(false);
    expect(
      asignarCedulariosSchema.safeParse({
        alumnoId,
        cedularios: [{ cedularioId: 'no-es-uuid', materias: 'todas' }],
      }).success,
    ).toBe(false);
    expect(
      asignarCedulariosSchema.safeParse({
        alumnoId,
        cedularios: [{ cedularioId: uuid(1), materias: [] }],
      }).success,
    ).toBe(false);
    expect(
      asignarCedulariosSchema.safeParse({
        alumnoId: 'x',
        cedularios: [{ cedularioId: uuid(1), materias: 'todas' }],
      }).success,
    ).toBe(false);
  });
});
