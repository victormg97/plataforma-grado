import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { MAX_NIVEL } from '../../tree';
import { LIMITES } from '../../schemas';
import { validarArbol } from '../advertencias';
import { aplanarArbol, parsearLineas, parsearTexto, type NodoImportacion } from '../index';
import { limpiarTexto } from '../limpieza';
import { lineasDesdeItems } from '../pdf-lineas';
import { LIMITES_IMPORTACION } from '../tipos';

const leer = (nombre: string) => readFileSync(join(__dirname, 'fixtures', nombre), 'utf8');
const UCN = leer('ucn-derecho-civil.md');
const USACH = leer('usach-derecho-procesal.md');

const UNIVERSIDADES = [
  { id: 'u-ucn', nombre: 'Universidad Católica del Norte', codigo: 'UCN' },
  { id: 'u-usach', nombre: 'Universidad de Santiago de Chile', codigo: 'USACH' },
  { id: 'u-uls', nombre: 'Universidad de La Serena', codigo: 'ULS' },
];

function buscar(raiz: readonly NodoImportacion[], nombre: string): NodoImportacion | undefined {
  for (const n of raiz) {
    if (n.nombre === nombre) return n;
    const dentro = buscar(n.children, nombre);
    if (dentro) return dentro;
  }
  return undefined;
}

describe('limites', () => {
  it('stay in sync with the database / schema limits', () => {
    expect(LIMITES_IMPORTACION.profundidad).toBe(MAX_NIVEL);
    expect(LIMITES_IMPORTACION.nombre).toBe(LIMITES.materiaNombre);
    expect(LIMITES_IMPORTACION.codigo).toBe(LIMITES.materiaCodigo);
  });
});

describe('UCN Derecho Civil (markdown)', () => {
  const r = parsearTexto(UCN, { universidades: UNIVERSIDADES });

  it('has 7 top-level sections', () => {
    expect(r.raiz).toHaveLength(7);
    expect(r.raiz.map((n) => n.etiqueta)).toEqual(['§ I.', '§ II.', '§ III.', '§ IV.', '§ V.', '§ VI.', '§ VII.']);
    expect(r.raiz[0].nombre).toBe('ACTO JURÍDICO');
    expect(r.raiz[6].nombre).toBe('DERECHO SUCESORIO');
  });

  it('nests Compraventa deeper than 5 levels with numeric path codes', () => {
    const compraventa = buscar(r.raiz, 'Compraventa');
    expect(compraventa?.codigo).toBe('4.2.2');

    const evicion = buscar(r.raiz, 'Saneamiento de la evicción');
    expect(evicion?.codigo).toBe('4.2.2.4.1.2.1');
    const plana = aplanarArbol(r.raiz);
    const fila = plana.find((m) => m.key === evicion?.key);
    expect(fila?.depth).toBe(7);
    // "Concepto y requisitos de la evicción" is level 8.
    const hoja = plana.find((m) => m.nombre === 'Concepto y requisitos de la evicción');
    expect(hoja?.depth).toBe(8);
    expect(hoja?.codigo).toBe('4.2.2.4.1.2.1.1');
    expect(r.profundidadMaxima).toBeGreaterThan(5);
  });

  it('every codigo is a numeric path matching the position in the tree', () => {
    const plana = aplanarArbol(r.raiz);
    const porKey = new Map(plana.map((m) => [m.key, m]));
    for (const m of plana) {
      expect(m.codigo).toMatch(/^\d+(\.\d+)*$/);
      const padre = m.parentKey ? porKey.get(m.parentKey) : undefined;
      expect(m.codigo.startsWith(padre ? `${padre.codigo}.` : '')).toBe(true);
    }
  });

  it('reads letter vs roman "i" by sequence and splits glued labels', () => {
    // "c. ... i. Actos unilaterales": roman i opens a sequence under c.
    const clasificacion = buscar(r.raiz, 'Clasificación de los actos jurídicos');
    expect(clasificacion?.children.map((c) => c.etiqueta)).toEqual(['i.', 'ii.', 'iii.', 'iv.', 'v.']);
    // "1. Concepto 2. Requisitos: ..." glued on one line
    const posesionRegular = buscar(r.raiz, 'Posesión regular');
    expect(posesionRegular?.children.map((c) => c.etiqueta)).toEqual(['1.', '2.']);
    // letter "h." then letter "i." in the same list (not roman)
    const sucesion = buscar(r.raiz, 'DEFINICIONES Y REGLAS GENERALES');
    expect(sucesion?.children.map((c) => c.etiqueta)).toEqual(['a.', 'b.', 'c.', 'd.', 'e.', 'f.', 'g.', 'h.']);
  });

  it('keeps label-only lines ("i.") with the text of the next line', () => {
    const bienes = buscar(r.raiz, 'Clasificaciones');
    expect(bienes?.children.map((c) => c.nombre)).toContain('Bienes corporales e incorporales.');
    expect(bienes?.children.map((c) => c.nombre)).toContain('Bienes fungibles y no fungibles.');
  });

  it('does not split "artículo 1554" or "arts. 150)"', () => {
    expect(buscar(r.raiz, 'Requisitos de la promesa: análisis del artículo 1554 del Código Civil')).toBeDefined();
    expect(buscar(r.raiz, 'Patrimonio reservado (arts. 150)')).toBeDefined();
  });

  it('detects metadata', () => {
    expect(r.metadatos.nombre).toBe('Temario de Derecho Civil');
    expect(r.metadatos.version).toBe('23 DE DICIEMBRE DE 2025');
    expect(r.metadatos.universidadTexto).toBe('UNIVERSIDAD CATÓLICA DEL NORTE');
    expect(r.metadatos.universidadId).toBe('u-ucn');
  });

  it('has no hard errors', () => {
    expect(r.hayErrores).toBe(false);
    expect(r.advertencias.filter((a) => a.severidad === 'error')).toEqual([]);
  });
});

describe('USACH Derecho Procesal (markdown)', () => {
  const r = parsearTexto(USACH, { universidades: UNIVERSIDADES });

  it('has 23 sections labeled with roman numerals', () => {
    expect(r.raiz).toHaveLength(23);
    expect(r.raiz[0].nombre).toBe('Introducción al Derecho Procesal');
    expect(r.raiz[22].nombre).toBe('Procedimientos especiales y recursos procesales.');
  });

  it('splits the glued line into sibling items', () => {
    const intro = r.raiz[0];
    const nombres = intro.children.map((c) => c.nombre);
    expect(nombres).toEqual([
      'El conflicto y sus formas de solución',
      'Concepto y contenido del Derecho Procesal',
      'Evolución del Derecho Procesal',
      'Características del Derecho Procesal',
      'Relaciones del Derecho Procesal con otras ramas del Derecho',
      'Fuentes del Derecho Procesal',
    ]);
    expect(intro.children.map((c) => c.codigo)).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6']);
  });

  it('makes 1) 2) items children of "ii. Ley Procesal"', () => {
    const ley = buscar(r.raiz, 'Ley Procesal');
    expect(ley?.etiqueta).toBe('ii.');
    expect(ley?.children.map((c) => c.nombre)).toEqual([
      'Concepto',
      'Naturaleza',
      'La ley procesal en el tiempo y en el espacio',
      'Interpretación e integración de la ley procesal',
    ]);
    // iii. and iv. continue as siblings of ii.
    const hermanos = buscar(r.raiz, 'Fuentes directas')?.children.map((c) => c.nombre);
    expect(hermanos).toEqual(['Constitución Política', 'Ley Procesal', 'Tratados Internacionales', 'Auto Acordados']);
  });

  it('removes picture-text comments and their content', () => {
    const plana = aplanarArbol(r.raiz);
    expect(plana.length).toBeGreaterThan(400);
    for (const m of plana) {
      expect(m.nombre).not.toMatch(/<!--|-->|picture text|<br|FACULTAD DEDERECHO|UNIVERSIDAD DE SANTIAGO/i);
    }
    expect(limpiarTexto(USACH).some((l) => /picture text|<!--/i.test(l.texto))).toBe(false);
  });

  it('detects metadata', () => {
    expect(r.metadatos.nombre).toBe('Cedulario ciclo Derecho Procesal');
    expect(r.metadatos.universidadId).toBe('u-usach');
    expect(r.metadatos.universidadTexto).toBe('UNIVERSIDAD DE SANTIAGO DE CHILE');
  });

  it('has no hard errors', () => {
    expect(r.hayErrores).toBe(false);
  });
});

describe('label disambiguation', () => {
  it('reads i after h as a letter, and i after a as roman', () => {
    const letras = parsearTexto('I.- T\n1. A\na. a\nb. b\nc. c\nd. d\ne. e\nf. f\ng. g\nh. h\ni. i\nj. j');
    expect(letras.raiz[0].children[0].children.map((c) => c.nombre)).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    );

    const romanos = parsearTexto('I.- T\n1. A\na. a\ni. uno\nii. dos\niii. tres\niv. cuatro\nv. cinco\nb. b');
    const a = romanos.raiz[0].children[0].children[0];
    expect(a.children.map((c) => c.etiqueta)).toEqual(['i.', 'ii.', 'iii.', 'iv.', 'v.']);
    expect(romanos.raiz[0].children[0].children).toHaveLength(2);
  });

  it('reuses a family at a deeper level when it starts again at 1', () => {
    const r = parsearTexto('§ I. S\n1. A\na. B\ni. C\n1. D\n2. E\nii. F\n2. G');
    const plana = aplanarArbol(r.raiz);
    expect(plana.find((m) => m.nombre === 'D')?.depth).toBe(5);
    expect(plana.find((m) => m.nombre === 'F')?.depth).toBe(4);
    // 2. after ii. continues the level-2 numbering (A was 1.), not the nested one.
    expect(plana.find((m) => m.nombre === 'G')?.depth).toBe(2);
  });

  it('never splits numbers inside prose', () => {
    const r = parsearTexto('I.- Tema\n1. Ver el artículo 1554 y Art. 688 del Código, ley 19.628 y el Decreto 3.');
    expect(r.raiz[0].children).toHaveLength(1);
    expect(r.raiz[0].children[0].nombre).toContain('artículo 1554');
  });

  it('joins lowercase continuation lines and reports stray capitalized lines', () => {
    const r = parsearTexto('I.- Tema\n1. Primera parte del\nsegmento largo\n2. Otra.\nTexto suelto');
    expect(r.raiz[0].children[0].nombre).toBe('Primera parte del segmento largo');
    expect(r.raiz[0].children[1].nombre).toBe('Otra. Texto suelto');
    expect(r.advertencias.some((a) => a.tipo === 'linea_sin_etiqueta')).toBe(true);
  });

  it('strips the trailing colon and reports numbering gaps', () => {
    const r = parsearTexto('I.- Tema:\n1. Uno:\n3. Tres');
    expect(r.raiz[0].nombre).toBe('Tema');
    expect(r.raiz[0].children[0].nombre).toBe('Uno');
    expect(r.advertencias.some((a) => a.tipo === 'salto_numeracion' && a.severidad === 'aviso')).toBe(true);
  });

  it('reports an error when there is no structure', () => {
    const r = parsearTexto('solo texto\nsin etiquetas');
    expect(r.raiz).toEqual([]);
    expect(r.hayErrores).toBe(true);
    expect(r.advertencias[0].tipo).toBe('sin_estructura');
  });
});

describe('limpieza', () => {
  it('removes comments, tags, bare page numbers and keeps original line numbers; bullets leave a marker', () => {
    const lineas = limpiarTexto('<!-- x\ny -->\n# **<u>Título</u>**\n\n- a. Uno<br>\n12\nPágina 3 de 10\n  \u2022 b. Dos');
    expect(lineas).toEqual([
      { texto: 'Título', numero: 3 },
      { texto: '\u2013 a. Uno', numero: 5 },
      { texto: '\u2022 b. Dos', numero: 8 },
    ]);
  });
});

describe('pdf-lineas', () => {
  const item = (str: string, x: number, y: number, page: number) => ({ str, x, y, fontSize: 10, page });

  it('groups items by line, orders them and drops repeated headers and page numbers', () => {
    const items = [
      item('Facultad de Derecho', 50, 800, 1),
      item('I.-', 50, 700, 1),
      item('Introducción', 70, 700.5, 1),
      item('1. Conflicto', 60, 680, 1),
      item('1', 300, 20, 1),
      item('Facultad de Derecho', 50, 800, 2),
      item('2. Concepto', 60, 700, 2),
      item('2', 300, 20, 2),
      item('Facultad de Derecho', 50, 800, 3),
      item('3. Evolución', 60, 700, 3),
      item('3', 300, 20, 3),
    ];
    const lineas = lineasDesdeItems(items).map((l) => l.trim());
    expect(lineas).toEqual(['I.- Introducción', '1. Conflicto', '2. Concepto', '3. Evolución']);
    const r = parsearLineas(lineas);
    expect(r.raiz).toHaveLength(1);
    expect(r.raiz[0].children.map((c) => c.nombre)).toEqual(['Conflicto', 'Concepto', 'Evolución']);
  });
});

describe('validarArbol', () => {
  const nodo = (key: string, codigo: string, nombre: string, children: NodoImportacion[] = []): NodoImportacion => ({
    key,
    etiqueta: null,
    nombre,
    codigo,
    children,
    lineaOrigen: 0,
  });

  it('flags depth over 10, empty names, long fields and duplicate sibling codes', () => {
    let hoja = nodo('d11', '1', 'x');
    for (let i = 10; i >= 1; i -= 1) hoja = nodo(`d${i}`, '1', 'x', [hoja]);
    expect(validarArbol([hoja]).map((a) => a.tipo)).toEqual(['profundidad_excedida']);

    const tipos = validarArbol([
      nodo('a', 'X', ' '),
      nodo('b', 'x', 'ok'),
      nodo('c', 'c'.repeat(31), 'n'.repeat(301)),
    ]).map((a) => a.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['nombre_vacio', 'codigo_duplicado', 'codigo_muy_largo', 'nombre_muy_largo']));
  });
});

describe('fast-check properties', () => {
  const FRAGMENTOS = [
    'I.-', '§ II.', 'IV.', '1.', '12.', '2)', 'a.', 'b)', '(c)', 'i.', 'ii.', 'v.', 'x.', 'iv)', 'Concepto', 'artículo 1554',
    'de la ley', ':', '<!--', '-->', '<br>', '- ', '## ', '**', '', '   ', '\t', 'ÁÉÍ', '99.', '0.', '1',
  ];
  const lineaArb = fc
    .array(fc.constantFrom(...FRAGMENTOS, ' '), { maxLength: 8 })
    .map((p) => p.join(' '));
  const textoArb = fc.oneof(
    fc.string({ maxLength: 400 }),
    fc.string({ unit: 'binary', maxLength: 200 }),
    fc.array(lineaArb, { maxLength: 40 }).map((ls) => ls.join('\n')),
  );

  it('never throws and returns a consistent tree', () => {
    fc.assert(
      fc.property(textoArb, (texto) => {
        const r = parsearTexto(texto);
        const plana = aplanarArbol(r.raiz);
        const porKey = new Map(plana.map((m) => [m.key, m]));
        expect(porKey.size).toBe(plana.length);

        const codigosPorPadre = new Map<string, Set<string>>();
        for (const m of plana) {
          // non-empty nombre
          expect(m.nombre.trim().length).toBeGreaterThan(0);
          // consistent depth
          const padre = m.parentKey === null ? null : porKey.get(m.parentKey);
          expect(padre === undefined).toBe(false);
          expect(m.depth).toBe(padre === null || padre === undefined ? 1 : padre.depth + 1);
          // unique sibling codigos
          const grupo = m.parentKey ?? '';
          const usados = codigosPorPadre.get(grupo) ?? new Set<string>();
          expect(usados.has(m.codigo.toLowerCase())).toBe(false);
          usados.add(m.codigo.toLowerCase());
          codigosPorPadre.set(grupo, usados);
        }
        expect(r.totalNodos).toBe(plana.length);
        expect(r.hayErrores).toBe(r.advertencias.some((a) => a.severidad === 'error'));
      }),
      { numRuns: 300 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(textoArb, (texto) => {
        expect(parsearTexto(texto)).toEqual(parsearTexto(texto));
      }),
      { numRuns: 100 },
    );
  });
});
