import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type { MateriaNodo } from '../../tree';
import { agregadoGlobal, construirAgregados } from '../agregados';
import {
  aplicarLoteOptimista,
  estadoVisual,
  objetivoAlternar,
  planificarCascada,
  planVacio,
  requiereConfirmacion,
  restaurarFilas,
} from '../cascada';
import type { Cobertura, ProgresoFila } from '../tipos';

const HOY = '2026-08-11';

function nodo(id: string, parentId: string | null, activo = true): MateriaNodo {
  return { id, parentId, nivel: 1, orden: 0, activo, codigo: id, nombre: id };
}

function fila(materiaId: string, estado: Cobertura = 'pendiente', asignada = true): ProgresoFila {
  return {
    id: `p-${materiaId}`,
    materiaId,
    asignada,
    estado,
    fechaCubierta: estado === 'cubierta' ? '2026-01-01' : null,
    notas: null,
    repasos: 2,
    comentarios: 0,
    clases: 0,
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function aplicar(flat: MateriaNodo[], progreso: ProgresoFila[], materiaId: string, objetivo: Cobertura) {
  const plan = planificarCascada({ flat, progreso, materiaId, objetivo });
  return { plan, filas: aplicarLoteOptimista(progreso, plan, HOY) };
}

const estadoPorMateria = (filas: ProgresoFila[]) =>
  Object.fromEntries(filas.map((f) => [f.materiaId, f.estado]));

// 1 ─┬─ 1.1 ─┬─ 1.1.1
//    │       └─ 1.1.2
//    └─ 1.2
// 2
const FLAT = [
  nodo('1', null),
  nodo('1.1', '1'),
  nodo('1.1.1', '1.1'),
  nodo('1.1.2', '1.1'),
  nodo('1.2', '1'),
  nodo('2', null),
];

describe('estadoVisual / objetivoAlternar / requiereConfirmacion', () => {
  it('derives the checkbox state from the aggregate', () => {
    expect(estadoVisual(undefined)).toBe('ninguna');
    expect(estadoVisual({ total: 0, cubiertas: 0 })).toBe('ninguna');
    expect(estadoVisual({ total: 3, cubiertas: 0 })).toBe('ninguna');
    expect(estadoVisual({ total: 3, cubiertas: 1 })).toBe('algunas');
    expect(estadoVisual({ total: 3, cubiertas: 3 })).toBe('todas');
  });

  it('a click covers anything not fully covered and unchecks a full branch', () => {
    expect(objetivoAlternar({ total: 2, cubiertas: 0 })).toBe('cubierta');
    expect(objetivoAlternar({ total: 2, cubiertas: 1 })).toBe('cubierta');
    expect(objetivoAlternar({ total: 2, cubiertas: 2 })).toBe('pendiente');
  });

  it('asks for confirmation from 2 lost dates', () => {
    expect(requiereConfirmacion(0)).toBe(false);
    expect(requiereConfirmacion(1)).toBe(false);
    expect(requiereConfirmacion(2)).toBe(true);
  });
});

describe('planificarCascada (examples)', () => {
  it('checking an assigned parent covers every assigned descendant', () => {
    const progreso = FLAT.map((n) => fila(n.id));
    const { plan, filas } = aplicar(FLAT, progreso, '1', 'cubierta');
    expect(plan.pendientes).toEqual([]);
    expect(new Set(plan.cubiertas)).toEqual(new Set(['p-1', 'p-1.1', 'p-1.1.1', 'p-1.1.2', 'p-1.2']));
    expect(estadoPorMateria(filas)['2']).toBe('pendiente');
    expect(filas.find((f) => f.materiaId === '1.2')?.fechaCubierta).toBe(HOY);
  });

  it('checking the last child covers the assigned ancestors up to level 1', () => {
    const progreso = [
      fila('1'),
      fila('1.1'),
      fila('1.1.1', 'cubierta'),
      fila('1.1.2'),
      fila('1.2', 'cubierta'),
      fila('2'),
    ];
    const { plan } = aplicar(FLAT, progreso, '1.1.2', 'cubierta');
    expect(new Set(plan.cubiertas)).toEqual(new Set(['p-1.1.2', 'p-1.1', 'p-1']));
    expect(plan.perdidas).toBe(0);
  });

  it('checking a child while siblings are pending leaves the parent pending', () => {
    const progreso = FLAT.map((n) => fila(n.id));
    const { plan } = aplicar(FLAT, progreso, '1.1.1', 'cubierta');
    expect(plan.cubiertas).toEqual(['p-1.1.1']);
  });

  it('unchecking a child makes the covered ancestors pending and counts only own losses', () => {
    const progreso = FLAT.map((n) => fila(n.id, 'cubierta'));
    const { plan } = aplicar(FLAT, progreso, '1.1.1', 'pendiente');
    expect(new Set(plan.pendientes)).toEqual(new Set(['p-1.1.1', 'p-1.1', 'p-1']));
    expect(plan.perdidas).toBe(1);
    expect(requiereConfirmacion(plan.perdidas)).toBe(false);
  });

  it('unchecking a branch counts every lost date of the branch', () => {
    const progreso = FLAT.map((n) => fila(n.id, 'cubierta'));
    const { plan } = aplicar(FLAT, progreso, '1.1', 'pendiente');
    expect(plan.perdidas).toBe(3);
    expect(requiereConfirmacion(plan.perdidas)).toBe(true);
  });

  it('a context parent (no row) acts on its assigned descendants and is never written', () => {
    const progreso = [fila('1.1.1'), fila('1.1.2'), fila('1.2', 'cubierta')];
    const { plan, filas } = aplicar(FLAT, progreso, '1', 'cubierta');
    expect(new Set(plan.cubiertas)).toEqual(new Set(['p-1.1.1', 'p-1.1.2']));
    expect(filas.every((f) => f.estado === 'cubierta')).toBe(true);
    const agregado = construirAgregados(FLAT, filas).get('1');
    expect(estadoVisual(agregado)).toBe('todas');
  });

  it('ignores archived rows and inactive materias', () => {
    const flat = [nodo('1', null), nodo('1.1', '1'), nodo('1.2', '1', false), nodo('1.3', '1')];
    const progreso = [fila('1'), fila('1.1', 'cubierta'), fila('1.2'), fila('1.3', 'pendiente', false)];
    const { plan } = aplicar(flat, progreso, '1', 'cubierta');
    expect(plan.cubiertas).toEqual(['p-1']);
    expect(plan.pendientes).toEqual([]);
  });

  it('keeps the date of rows already covered and keeps child records untouched', () => {
    const progreso = [fila('1'), fila('1.1', 'cubierta'), fila('1.1.1'), fila('1.1.2'), fila('1.2')];
    const { filas } = aplicar(FLAT, progreso, '1', 'cubierta');
    expect(filas.find((f) => f.materiaId === '1.1')?.fechaCubierta).toBe('2026-01-01');
    expect(filas.every((f) => f.repasos === 2)).toBe(true);
  });

  it('an unknown materia gives an empty plan', () => {
    expect(planVacio(planificarCascada({ flat: FLAT, progreso: [], materiaId: 'x', objetivo: 'cubierta' }))).toBe(true);
  });

  it('restaurarFilas puts the previous rows back', () => {
    const progreso = FLAT.map((n) => fila(n.id));
    const { plan, filas } = aplicar(FLAT, progreso, '1', 'cubierta');
    const previas = progreso.filter((f) => plan.cubiertas.includes(f.id));
    expect(restaurarFilas(filas, previas)).toEqual(progreso);
  });
});

// ---------------------------------------------------------------------------
// Properties over random trees
// ---------------------------------------------------------------------------

interface Escenario {
  flat: MateriaNodo[];
  progreso: ProgresoFila[];
}

/** Random forest: node i has a parent among the previous ones (or none), a random subset is assigned. */
const escenarioArb = fc
  .array(
    fc.record({
      padre: fc.option(fc.nat(), { nil: null }),
      activo: fc.boolean(),
      asignada: fc.constantFrom<'no' | 'si' | 'archivada'>('no', 'si', 'si', 'si', 'archivada'),
      cubierta: fc.boolean(),
    }),
    { minLength: 1, maxLength: 25 },
  )
  .map((items): Escenario => {
    const flat: MateriaNodo[] = [];
    const progreso: ProgresoFila[] = [];
    items.forEach((item, i) => {
      const id = `m${i}`;
      const parentId = i === 0 || item.padre === null ? null : `m${item.padre % i}`;
      // ~1 of 8 inactive
      const activo = item.activo || i % 8 !== 7;
      flat.push(nodo(id, parentId, activo));
      if (item.asignada !== 'no') {
        progreso.push(fila(id, item.cubierta ? 'cubierta' : 'pendiente', item.asignada === 'si'));
      }
    });
    return { flat, progreso };
  });

/** Same scenario, but every assigned ancestor already agrees with its descendants. */
function consistente({ flat, progreso }: Escenario): Escenario {
  // Process deepest first: a parent is covered iff every assigned active descendant is.
  const porId = new Map(flat.map((n) => [n.id, n]));
  const profundidad = (id: string) => {
    let d = 0;
    let actual = porId.get(id);
    while (actual?.parentId) {
      d += 1;
      actual = porId.get(actual.parentId);
    }
    return d;
  };
  let filas = progreso;
  const orden = [...flat].sort((a, b) => profundidad(b.id) - profundidad(a.id));
  for (const n of orden) {
    const propia = filas.find((f) => f.materiaId === n.id && f.asignada);
    if (!propia || !n.activo) continue;
    const desc = descendientesAsignados(flat, filas, n.id);
    if (desc.length === 0) continue;
    const estado: Cobertura = desc.every((f) => f.estado === 'cubierta') ? 'cubierta' : 'pendiente';
    filas = filas.map((f) =>
      f.id === propia.id
        ? { ...f, estado, fechaCubierta: estado === 'cubierta' ? '2026-01-01' : null }
        : f,
    );
  }
  return { flat, progreso: filas };
}

function descendientesAsignados(flat: MateriaNodo[], filas: ProgresoFila[], raiz: string): ProgresoFila[] {
  const activos = new Set(flat.filter((n) => n.activo).map((n) => n.id));
  const ids = new Set<string>();
  const pila = flat.filter((n) => n.parentId === raiz).map((n) => n.id);
  while (pila.length > 0) {
    const id = pila.pop() as string;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const n of flat) if (n.parentId === id) pila.push(n.id);
  }
  return filas.filter((f) => f.asignada && ids.has(f.materiaId) && activos.has(f.materiaId));
}

function ancestros(flat: MateriaNodo[], id: string): Set<string> {
  const porId = new Map(flat.map((n) => [n.id, n]));
  const res = new Set<string>();
  let actual = porId.get(id)?.parentId ?? null;
  while (actual !== null && !res.has(actual)) {
    res.add(actual);
    actual = porId.get(actual)?.parentId ?? null;
  }
  return res;
}

const casoArb = escenarioArb.chain((esc) =>
  fc.record({
    esc: fc.constant(esc),
    materia: fc.constantFrom(...esc.flat.map((n) => n.id)),
    objetivo: fc.constantFrom<Cobertura>('cubierta', 'pendiente'),
  }),
);

describe('planificarCascada (properties)', () => {
  it('plans only real, disjoint changes and is idempotent', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const { plan, filas } = aplicar(esc.flat, esc.progreso, materia, objetivo);
        const todos = [...plan.cubiertas, ...plan.pendientes];
        expect(new Set(todos).size).toBe(todos.length);
        for (const id of plan.cubiertas) expect(esc.progreso.find((f) => f.id === id)?.estado).toBe('pendiente');
        for (const id of plan.pendientes) expect(esc.progreso.find((f) => f.id === id)?.estado).toBe('cubierta');
        expect(planVacio(planificarCascada({ flat: esc.flat, progreso: filas, materiaId: materia, objetivo }))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('the subtree takes the target, rows outside subtree and ancestors never change, context and archived never appear', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const { plan, filas } = aplicar(esc.flat, esc.progreso, materia, objetivo);
        const activos = new Set(esc.flat.filter((n) => n.activo).map((n) => n.id));
        const propia = esc.progreso.find((f) => f.materiaId === materia && f.asignada && activos.has(materia));
        const subarbol = [...descendientesAsignados(esc.flat, esc.progreso, materia), ...(propia ? [propia] : [])];
        const idsSub = new Set(subarbol.map((f) => f.id));
        for (const f of filas) if (idsSub.has(f.id)) expect(f.estado).toBe(objetivo);

        const cadena = ancestros(esc.flat, materia);
        const validos = new Set(
          esc.progreso.filter((f) => f.asignada && activos.has(f.materiaId)).map((f) => f.id),
        );
        for (const id of [...plan.cubiertas, ...plan.pendientes]) {
          expect(validos.has(id)).toBe(true);
          const f = esc.progreso.find((x) => x.id === id) as ProgresoFila;
          expect(idsSub.has(id) || cadena.has(f.materiaId)).toBe(true);
        }
        let perdidas = 0;
        for (const f of subarbol) if (f.estado === 'cubierta' && objetivo === 'pendiente') perdidas += 1;
        expect(plan.perdidas).toBe(perdidas);
      }),
      { numRuns: 300 },
    );
  });

  it('ancestors move only in the direction of the action', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const { plan } = aplicar(esc.flat, esc.progreso, materia, objetivo);
        if (objetivo === 'cubierta') expect(plan.pendientes).toEqual([]);
        else expect(plan.cubiertas).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('with consistent data, every assigned ancestor is covered iff all its assigned descendants are', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const base = consistente(esc);
        const { filas } = aplicar(base.flat, base.progreso, materia, objetivo);
        const activos = new Set(base.flat.filter((n) => n.activo).map((n) => n.id));
        for (const anc of ancestros(base.flat, materia)) {
          const propia = filas.find((f) => f.materiaId === anc && f.asignada);
          if (!propia || !activos.has(anc)) continue;
          const desc = descendientesAsignados(base.flat, filas, anc);
          if (desc.length === 0) continue;
          expect(propia.estado === 'cubierta').toBe(desc.every((f) => f.estado === 'cubierta'));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('a branch without changes never touches its ancestors', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const marcado = aplicar(esc.flat, esc.progreso, materia, objetivo).filas;
        // Second identical click on any data, even inconsistent: nothing changes.
        expect(planVacio(planificarCascada({ flat: esc.flat, progreso: marcado, materiaId: materia, objetivo }))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('with consistent data, check then uncheck equals a direct uncheck and restores a pending branch', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia }) => {
        const base = consistente(esc);
        const marcado = aplicar(base.flat, base.progreso, materia, 'cubierta').filas;
        const idaVuelta = aplicar(base.flat, marcado, materia, 'pendiente').filas;
        const directo = aplicar(base.flat, base.progreso, materia, 'pendiente').filas;
        expect(estadoPorMateria(idaVuelta)).toEqual(estadoPorMateria(directo));

        const pendiente = aplicar(base.flat, base.progreso, materia, 'pendiente').filas;
        const otraVez = aplicar(
          base.flat,
          aplicar(base.flat, pendiente, materia, 'cubierta').filas,
          materia,
          'pendiente',
        ).filas;
        expect(estadoPorMateria(otraVez)).toEqual(estadoPorMateria(pendiente));
      }),
      { numRuns: 200 },
    );
  });

  it('aggregates after applying stay coherent with the global aggregate', () => {
    fc.assert(
      fc.property(casoArb, ({ esc, materia, objetivo }) => {
        const { filas } = aplicar(esc.flat, esc.progreso, materia, objetivo);
        const agregados = construirAgregados(esc.flat, filas);
        const global = agregadoGlobal(agregados, esc.flat);
        const activos = new Set(esc.flat.filter((n) => n.activo).map((n) => n.id));
        // The global aggregate only sums active roots, so it never exceeds the counted rows.
        const cuentan = filas.filter((f) => f.asignada && activos.has(f.materiaId));
        expect(global.total).toBeLessThanOrEqual(cuentan.length);
        expect(global.cubiertas).toBeLessThanOrEqual(global.total);
        // The clicked branch shows exactly the target state afterwards.
        const sub = agregados.get(materia);
        if (sub && sub.total > 0) {
          expect(estadoVisual(sub)).toBe(objetivo === 'cubierta' ? 'todas' : 'ninguna');
        }
      }),
      { numRuns: 200 },
    );
  });
});
