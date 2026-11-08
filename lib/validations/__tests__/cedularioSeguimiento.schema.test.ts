import { describe, expect, it } from 'vitest';
import {
  MAX_CEDULARIOS_POR_ASIGNACION,
  MAX_LOTE_PROGRESO,
} from '@/lib/cedularios/seguimiento/constants';
import { asignarCedulariosSchema, estadosMateriasSchema } from '../cedularioSeguimiento.schema';

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

describe('estadosMateriasSchema', () => {
  const asignacionId = uuid(999);
  const ids = (desde: number, n: number) => Array.from({ length: n }, (_, i) => uuid(desde + i));

  it('acepta lotes disjuntos, incluidos lados vacios', () => {
    expect(
      estadosMateriasSchema.safeParse({ asignacionId, cubiertas: ids(1, 3), pendientes: ids(10, 2) }).success,
    ).toBe(true);
    expect(estadosMateriasSchema.safeParse({ asignacionId, cubiertas: [], pendientes: [] }).success).toBe(true);
  });

  it('rechaza ids repetidos dentro o entre ambos lados', () => {
    expect(
      estadosMateriasSchema.safeParse({ asignacionId, cubiertas: [uuid(1), uuid(1)], pendientes: [] }).success,
    ).toBe(false);
    expect(
      estadosMateriasSchema.safeParse({
        asignacionId,
        cubiertas: [uuid(1)],
        pendientes: [uuid(1).toUpperCase()],
      }).success,
    ).toBe(false);
  });

  it('acepta hasta el maximo en total y rechaza pasarse', () => {
    const mitad = MAX_LOTE_PROGRESO / 2;
    expect(
      estadosMateriasSchema.safeParse({
        asignacionId,
        cubiertas: ids(1, mitad),
        pendientes: ids(10_000, mitad),
      }).success,
    ).toBe(true);
    expect(
      estadosMateriasSchema.safeParse({
        asignacionId,
        cubiertas: ids(1, mitad),
        pendientes: ids(10_000, mitad + 1),
      }).success,
    ).toBe(false);
  });

  it('rechaza una asignacion o un id invalido', () => {
    expect(estadosMateriasSchema.safeParse({ asignacionId: 'x', cubiertas: [], pendientes: [] }).success).toBe(false);
    expect(
      estadosMateriasSchema.safeParse({ asignacionId, cubiertas: ['no-es-uuid'], pendientes: [] }).success,
    ).toBe(false);
  });
});
