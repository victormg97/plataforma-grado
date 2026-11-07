import { describe, expect, it } from 'vitest';

import { importacionSchema, prepararMateriasRpc } from '../schema';

const UNI = '98f25318-3d3a-40bf-b560-53a3b8161bdf';
const base = { universidad_id: UNI, nombre: 'Temario', version: '2025' };
const m = (key: string, parentKey: string | null, codigo: string, nombre = 'x') => ({ key, parentKey, codigo, nombre });

describe('importacionSchema', () => {
  it('accepts a valid tree', () => {
    const r = importacionSchema.safeParse({
      cedulario: base,
      materias: [m('a', null, '1'), m('b', 'a', '1.1'), m('c', 'a', '1.2'), m('d', null, '2')],
    });
    expect(r.success).toBe(true);
  });

  const mensajes = (input: unknown) => {
    const r = importacionSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it('rejects empty and oversize lists', () => {
    expect(mensajes({ cedulario: base, materias: [] })).toEqual(['validacion']);
    const muchas = Array.from({ length: 5001 }, (_, i) => m(`k${i}`, null, String(i + 1)));
    expect(mensajes({ cedulario: base, materias: muchas })).toEqual(['validacion']);
  });

  it('rejects unknown parents, parents after children and repeated keys', () => {
    expect(mensajes({ cedulario: base, materias: [m('a', 'zz', '1')] })).toEqual(['materia_padre_invalida']);
    expect(mensajes({ cedulario: base, materias: [m('b', 'a', '1'), m('a', null, '2')] })).toEqual([
      'materia_padre_invalida',
    ]);
    expect(mensajes({ cedulario: base, materias: [m('a', null, '1'), m('a', null, '2')] })).toEqual([
      'materia_padre_invalida',
    ]);
  });

  it('rejects depth over 10 and accepts exactly 10', () => {
    const cadena = (n: number) => Array.from({ length: n }, (_, i) => m(`k${i}`, i === 0 ? null : `k${i - 1}`, '1'));
    expect(importacionSchema.safeParse({ cedulario: base, materias: cadena(10) }).success).toBe(true);
    expect(mensajes({ cedulario: base, materias: cadena(11) })).toEqual(['nivel_maximo']);
  });

  it('rejects duplicate sibling codes (case-insensitive) but allows them under different parents', () => {
    expect(mensajes({ cedulario: base, materias: [m('a', null, 'A'), m('b', null, ' a ')] })).toEqual([
      'codigo_duplicado_nivel',
    ]);
    const ok = importacionSchema.safeParse({
      cedulario: base,
      materias: [m('a', null, '1'), m('b', null, '2'), m('c', 'a', '1'), m('d', 'b', '1')],
    });
    expect(ok.success).toBe(true);
  });

  it('enforces field limits', () => {
    expect(mensajes({ cedulario: base, materias: [m('a', null, 'c'.repeat(31))] })).toEqual(['codigo_muy_largo']);
    expect(mensajes({ cedulario: base, materias: [m('a', null, '1', 'n'.repeat(301))] })).toEqual(['nombre_muy_largo']);
    expect(mensajes({ cedulario: base, materias: [m('a', null, '1', '  ')] })).toEqual(['nombre_requerido']);
    expect(mensajes({ cedulario: { ...base, universidad_id: 'no' }, materias: [m('a', null, '1')] })).toEqual([
      'universidad_invalida',
    ]);
  });
});

describe('prepararMateriasRpc', () => {
  it('assigns ids, depth, parent ids and orden in multiples of 1024', () => {
    let n = 0;
    const filas = prepararMateriasRpc(
      [m('a', null, '1'), m('b', 'a', '1.1'), m('c', 'a', '1.2'), m('d', null, '2'), m('e', 'c', '1.2.1')],
      () => `id-${(n += 1)}`,
    );
    expect(filas).toEqual([
      { id: 'id-1', parent_id: null, depth: 1, codigo: '1', nombre: 'x', orden: 1024 },
      { id: 'id-2', parent_id: 'id-1', depth: 2, codigo: '1.1', nombre: 'x', orden: 1024 },
      { id: 'id-3', parent_id: 'id-1', depth: 2, codigo: '1.2', nombre: 'x', orden: 2048 },
      { id: 'id-4', parent_id: null, depth: 1, codigo: '2', nombre: 'x', orden: 2048 },
      { id: 'id-5', parent_id: 'id-3', depth: 3, codigo: '1.2.1', nombre: 'x', orden: 1024 },
    ]);
  });
});
