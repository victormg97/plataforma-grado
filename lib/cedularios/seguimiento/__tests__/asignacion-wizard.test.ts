import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type { MateriaNodo } from '@/lib/cedularios/tree';
import {
  accionRamas,
  alternarCedulario,
  construirEnvio,
  depurarCedularios,
  deseleccionarGrupo,
  estadoGrupo,
  hayProgreso,
  idsConHijos,
  idsTodasLasRamas,
  materiasPorDefecto,
  pasoAnterior,
  pasoSiguiente,
  pasosDelModo,
  puedeAvanzar,
  resumirResultados,
  seleccionarGrupo,
  sincronizarMaterias,
  type EstadoWizard,
  type ResultadoAsignacionCedulario,
} from '../asignacion-wizard';

const ids = fc.array(fc.uuid(), { maxLength: 12 });

function estado(parcial: Partial<EstadoWizard> = {}): EstadoWizard {
  return {
    paso: 'seleccion',
    cedularioIds: [],
    alumnoIds: [],
    materias: {},
    indiceMaterias: 0,
    ...parcial,
  };
}

function nodo(id: string, parentId: string | null, activo = true): MateriaNodo {
  return { id, parentId, nivel: parentId ? 2 : 1, orden: 0, activo, codigo: id, nombre: id };
}

describe('pasos', () => {
  it('el modo reasignar salta la seleccion', () => {
    expect(pasosDelModo('reasignar')).toEqual(['materias', 'confirmar']);
    expect(pasosDelModo('alumno')).toEqual(['seleccion', 'materias', 'confirmar']);
    expect(pasosDelModo('cedulario')).toEqual(['seleccion', 'materias', 'confirmar']);
  });

  it('avanza y retrocede sin salirse de los limites', () => {
    expect(pasoSiguiente('alumno', 'seleccion')).toBe('materias');
    expect(pasoSiguiente('alumno', 'confirmar')).toBe('confirmar');
    expect(pasoAnterior('alumno', 'seleccion')).toBe('seleccion');
    expect(pasoAnterior('reasignar', 'confirmar')).toBe('materias');
    expect(pasoAnterior('reasignar', 'materias')).toBe('materias');
  });
});

describe('alternarCedulario', () => {
  it('agrega y quita, y mantiene el orden de eleccion', () => {
    const a = alternarCedulario([], 'a', []);
    const b = alternarCedulario(a, 'b', []);
    expect(b).toEqual(['a', 'b']);
    expect(alternarCedulario(b, 'a', [])).toEqual(['b']);
  });

  it('ignora los ya asignados', () => {
    expect(alternarCedulario([], 'x', ['x'])).toEqual([]);
  });

  it('alternar dos veces devuelve la seleccion original y nunca duplica', () => {
    fc.assert(
      fc.property(ids, fc.uuid(), (lista, id) => {
        const base = depurarCedularios(lista, []).filter((x) => x.toLowerCase() !== id.toLowerCase());
        const una = alternarCedulario(base, id, []);
        const dos = alternarCedulario(una, id, []);
        expect(new Set(una.map((x) => x.toLowerCase())).size).toBe(una.length);
        expect(dos).toEqual(base);
      }),
    );
  });
});

describe('grupos por universidad', () => {
  it('seleccionar todo solo agrega los seleccionables del grupo', () => {
    const resultado = seleccionarGrupo(['z'], ['a', 'b', 'c'], ['b']);
    expect(resultado).toEqual(['z', 'a', 'c']);
  });

  it('deseleccionar todo solo quita los del grupo', () => {
    expect(deseleccionarGrupo(['z', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['z']);
  });

  it('estadoGrupo cuenta solo los seleccionables', () => {
    expect(estadoGrupo(['a'], ['a', 'b', 'c'], ['c'])).toEqual({
      seleccionados: 1,
      seleccionables: 2,
      todos: false,
      ninguno: false,
    });
    expect(estadoGrupo(['a', 'b'], ['a', 'b', 'c'], ['c']).todos).toBe(true);
    expect(estadoGrupo([], ['c'], ['c'])).toMatchObject({ todos: false, ninguno: true });
  });

  it('seleccionar y deseleccionar nunca tocan ids fuera del grupo ni duplican', () => {
    fc.assert(
      fc.property(ids, ids, ids, (actual, grupo, asignados) => {
        const sel = seleccionarGrupo(actual, grupo, asignados);
        const fuera = actual.filter((id) => !grupo.includes(id));
        expect(sel.filter((id) => !grupo.includes(id))).toEqual(fuera);
        const propios = sel.filter((id) => !actual.includes(id));
        for (const id of propios) expect(asignados.map((x) => x.toLowerCase())).not.toContain(id.toLowerCase());
        const sin = deseleccionarGrupo(sel, grupo);
        expect(sin.filter((id) => !grupo.includes(id))).toEqual(fuera);
        expect(sin.some((id) => grupo.includes(id))).toBe(false);
      }),
    );
  });
});

describe('depurarCedularios', () => {
  it('quita duplicados, asignados y no disponibles', () => {
    expect(depurarCedularios(['A', 'a', 'b', 'c', 'd'], ['b'], ['a', 'b', 'c'])).toEqual(['A', 'c']);
  });

  it('es idempotente y no deja duplicados', () => {
    fc.assert(
      fc.property(ids, ids, (lista, asignados) => {
        const una = depurarCedularios([...lista, ...lista], asignados);
        expect(depurarCedularios(una, asignados)).toEqual(una);
        expect(new Set(una.map((x) => x.toLowerCase())).size).toBe(una.length);
      }),
    );
  });
});

describe('materias por cedulario', () => {
  it('materiasPorDefecto usa todas salvo lo ya decidido', () => {
    expect(materiasPorDefecto(['a', 'b'], { a: ['m1'] })).toEqual({ a: ['m1'], b: 'todas' });
  });

  it('sincronizarMaterias conserva lo elegido, quita deseleccionados y agrega nuevos', () => {
    const previas = { a: ['m1'], b: 'todas' as const };
    expect(sincronizarMaterias(previas, ['a', 'c'])).toEqual({ a: ['m1'], c: 'todas' });
  });

  it('volver atras y avanzar no pierde entradas de cedularios que siguen elegidos', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 6 }), (lista) => {
        const materias = Object.fromEntries(lista.map((id) => [id, ['m'] as string[]]));
        expect(sincronizarMaterias(materias, lista)).toEqual(materias);
      }),
    );
  });
});

describe('ramas del arbol', () => {
  const flat = [nodo('r1', null), nodo('h1', 'r1'), nodo('h2', 'r1', false), nodo('r2', null), nodo('x', null, false)];

  it('detecta ramas y padres activos', () => {
    expect(idsTodasLasRamas(flat)).toEqual(['r1', 'h1', 'r2']);
    expect(idsConHijos(flat)).toEqual(['r1']);
  });

  it('marcar es una union y nunca pide confirmacion', () => {
    const r = accionRamas({ accion: 'marcar', seleccion: new Set(['h1', 'otro']), flat });
    expect(r.requiereConfirmacion).toBe(false);
    expect([...r.siguiente].sort()).toEqual(['h1', 'otro', 'r1', 'r2']);
  });

  it('desmarcar pide confirmacion solo si hay seleccion', () => {
    const con = accionRamas({ accion: 'desmarcar', seleccion: new Set(['h1']), flat });
    expect(con.requiereConfirmacion).toBe(true);
    expect(con.siguiente.size).toBe(0);
    const sin = accionRamas({ accion: 'desmarcar', seleccion: new Set(), flat });
    expect(sin.requiereConfirmacion).toBe(false);
  });
});

describe('puedeAvanzar', () => {
  it('el paso 1 necesita al menos una eleccion', () => {
    expect(puedeAvanzar('alumno', estado())).toBe(false);
    expect(puedeAvanzar('alumno', estado({ cedularioIds: ['a'] }))).toBe(true);
    expect(puedeAvanzar('cedulario', estado({ cedularioIds: ['a'] }))).toBe(false);
    expect(puedeAvanzar('cedulario', estado({ alumnoIds: ['u'] }))).toBe(true);
  });

  it('el paso de materias rechaza una lista vacia', () => {
    const base = { paso: 'materias' as const, cedularioIds: ['a'] };
    expect(puedeAvanzar('alumno', estado({ ...base, materias: { a: 'todas' } }))).toBe(true);
    expect(puedeAvanzar('alumno', estado({ ...base, materias: { a: [] } }))).toBe(false);
    expect(puedeAvanzar('alumno', estado({ ...base, materias: { a: ['m'] } }))).toBe(true);
  });
});

describe('hayProgreso', () => {
  it('es falso con los valores por defecto', () => {
    expect(hayProgreso(estado(), 'alumno')).toBe(false);
    expect(hayProgreso(estado({ cedularioIds: ['a'], materias: { a: 'todas' } }), 'alumno')).toBe(true);
    expect(hayProgreso(estado({ cedularioIds: ['a'], materias: { a: 'todas' } }), 'reasignar')).toBe(false);
  });

  it('detecta alumnos elegidos y materias distintas del defecto', () => {
    expect(hayProgreso(estado({ alumnoIds: ['u'] }), 'cedulario')).toBe(true);
    expect(hayProgreso(estado({ cedularioIds: ['a'], materias: { a: ['m'] } }), 'reasignar')).toBe(true);
  });

  it('en reasignar el defecto son las materias iniciales', () => {
    const e = estado({ cedularioIds: ['a'], materias: { a: ['m1', 'm2'] } });
    expect(hayProgreso(e, 'reasignar', ['m2', 'm1'])).toBe(false);
    expect(hayProgreso(e, 'reasignar', ['m1'])).toBe(true);
  });
});

describe('construirEnvio y resumirResultados', () => {
  it('envia en el orden elegido', () => {
    const e = estado({ cedularioIds: ['b', 'a'], materias: { a: ['m'], b: 'todas' } });
    expect(construirEnvio(e)).toEqual([
      { cedularioId: 'b', materias: 'todas' },
      { cedularioId: 'a', materias: ['m'] },
    ]);
  });

  it('cuenta asignados, reactivados, ya asignados y fallidos', () => {
    const filas: ResultadoAsignacionCedulario[] = [
      { cedularioId: 'a', resultado: 'asignado', asignacionId: '1' },
      { cedularioId: 'b', resultado: 'reactivado', asignacionId: '2' },
      { cedularioId: 'c', resultado: 'rechazado', motivo: 'asignacion_duplicada' },
      { cedularioId: 'd', resultado: 'rechazado', motivo: 'cedulario_no_disponible' },
    ];
    expect(resumirResultados(filas)).toEqual({
      asignados: 1,
      reactivados: 1,
      yaAsignados: 1,
      fallidos: ['d'],
    });
  });
});
