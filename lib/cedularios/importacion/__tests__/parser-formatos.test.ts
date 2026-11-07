import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { aplanarArbol, parsearTexto, type NodoImportacion } from '../index';

/**
 * Lines of "Propuesta modificación cedulario Derecho Procesal" (UCN) as pdfjs produces them.
 * Unusual format: roman numeral without a dot ("II ACTOS..."), decimal labels ("3.1)"), uppercase
 * letters ("A.", "B)"), ● and - bullets, a repeated "d)" and a title split over two lines.
 */
const PROPUESTA = readFileSync(join(__dirname, 'fixtures', 'ucn-derecho-procesal-pdf-lineas.txt'), 'utf8');

function buscar(raiz: readonly NodoImportacion[], nombre: string | RegExp): NodoImportacion | undefined {
  for (const n of raiz) {
    if (typeof nombre === 'string' ? n.nombre === nombre : nombre.test(n.nombre)) return n;
    const dentro = buscar(n.children, nombre);
    if (dentro) return dentro;
  }
  return undefined;
}

describe('Propuesta cedulario Derecho Procesal UCN (PDF)', () => {
  const r = parsearTexto(PROPUESTA);

  it('has no hard errors and no oversized names', () => {
    expect(r.hayErrores).toBe(false);
    expect(aplanarArbol(r.raiz).every((m) => m.nombre.length <= 300)).toBe(true);
  });

  it('reads the 7 sections, including "II" without a dot', () => {
    expect(r.raiz.map((n) => n.etiqueta)).toEqual(['I.', 'II', 'III.', 'IV.', 'V.', 'VI.', 'VII.']);
    expect(r.raiz[1].nombre).toBe('ACTOS PROCESALES Y DISPOSICIONES COMUNES A TODO PROCEDIMIENTO');
    expect(r.raiz[1].children.map((c) => c.etiqueta)).toEqual(['1.', '2.', '3.', '4.']);
  });

  it('splits "3. TEORÍA DE LA ACCIÓN" into its 3.1) .. 3.4) items', () => {
    const teoria = buscar(r.raiz, 'TEORÍA DE LA ACCIÓN');
    expect(teoria?.children.map((c) => c.etiqueta)).toEqual(['3.1)', '3.2)', '3.3)', '3.4)']);
    // continuation line "Formulaciones doctrinales." stays with its item
    expect(teoria?.children[0].nombre).toBe(
      'La acción como derecho a la tutela jurisdiccional concreta: Formulaciones doctrinales.',
    );
    expect(teoria?.children[3].children.map((c) => c.etiqueta)).toEqual(['B)', 'C)']);
  });

  it('turns ● bullets into children of their item instead of merging them', () => {
    const notificaciones = buscar(r.raiz, 'Las notificaciones.');
    expect(notificaciones?.children).toHaveLength(3);
    expect(notificaciones?.children.every((c) => c.etiqueta === '●')).toBe(true);
    expect(notificaciones?.children[2].nombre).toMatch(/^Especies de notificación: .* Ley N° 20\.886\.$/);
  });

  it('reads VI.2.C as "ETAPA INTERMEDIA", not as the roman numeral C', () => {
    const penal = r.raiz[5];
    expect(penal.nombre).toBe('DERECHO PROCESAL PENAL');
    const etapas = penal.children[1];
    expect(etapas.children.map((c) => c.etiqueta)).toEqual(['A.', 'B.', 'C.', 'D.', 'E.']);
    const intermedia = buscar(r.raiz, 'ETAPA INTERMEDIA');
    expect(intermedia?.codigo).toBe('6.2.3');
    expect(buscar(r.raiz, 'ETAPA DE SENTENCIA')?.codigo).toBe('6.2.5');
    expect(r.raiz[6].etiqueta).toBe('VII.');
  });

  it('nests "-" bullets under the ● bullet and keeps a repeated "d)" from swallowing the next items', () => {
    const debates = buscar(r.raiz, /^Debates sobre las pruebas/);
    expect(debates?.children.map((c) => c.etiqueta)).toEqual(['-', '-', '-', '-']);

    // "d) Otras pruebas" is written twice as "d)"; "iv) Alegatos finales" still continues "iii)".
    const produccion = buscar(r.raiz, 'Producción de prueba');
    const alegatos = buscar(r.raiz, 'Alegatos finales');
    const clausura = buscar(r.raiz, 'Clausura del debate');
    const debate = buscar(r.raiz, 'Debate en juicio oral');
    expect(debate?.children).toContain(produccion);
    expect(debate?.children).toContain(alegatos);
    expect(debate?.children).toContain(clausura);
  });

  it('joins a title split over two lines', () => {
    expect(r.metadatos.nombre).toBe('Cedulario de Derecho Procesal');
    expect(r.metadatos.version).toBe('30 DE MARZO DE 2022');
  });
});

describe('new label shapes', () => {
  it('reads decimal labels as children of their number', () => {
    const r = parsearTexto('1. Uno\n1.1. Primero\n1.2. Segundo\n2. Dos\n2.1) Otro');
    expect(r.raiz.map((n) => n.etiqueta)).toEqual(['1.', '2.']);
    expect(r.raiz[0].children.map((c) => c.etiqueta)).toEqual(['1.1.', '1.2.']);
    expect(r.raiz[1].children.map((c) => c.etiqueta)).toEqual(['2.1)']);
  });

  it('tells uppercase letter C from roman 100 by the sequence', () => {
    const letras = parsearTexto('1. Etapas\nA. Uno\nB. Dos\nC. Tres\nD. Cuatro');
    expect(letras.raiz[0].children.map((c) => c.etiqueta)).toEqual(['A.', 'B.', 'C.', 'D.']);

    const romanos = parsearTexto('I. Uno\nII. Dos\nIII. Tres\nIV. Cuatro');
    expect(romanos.raiz.map((n) => n.etiqueta)).toEqual(['I.', 'II.', 'III.', 'IV.']);
  });

  it('does not split a mid-line initial such as "A. Bello"', () => {
    const r = parsearTexto('1. Doctrina\na. Obras de Andrés A. Bello y otros');
    expect(r.raiz[0].children).toHaveLength(1);
    expect(r.raiz[0].children[0].nombre).toBe('Obras de Andrés A. Bello y otros');
  });

  it('accepts "II TITLE" only when it continues a roman sequence', () => {
    const r = parsearTexto('I. PRIMERA PARTE\n1. Uno\nII SEGUNDA PARTE\n1. Otro');
    expect(r.raiz.map((n) => n.nombre)).toEqual(['PRIMERA PARTE', 'SEGUNDA PARTE']);

    // never opens the document and never becomes a label out of sequence
    const suelto = parsearTexto('1. Uno\nMI CASA ES GRANDE\n2. Dos');
    expect(suelto.raiz.map((n) => n.etiqueta)).toEqual(['1.', '2.']);
    expect(suelto.raiz[0].nombre).toBe('Uno MI CASA ES GRANDE');
  });

  it('keeps a bullet that follows a label alone on its line as the text of that label', () => {
    const r = parsearTexto('a. Uno\ni.\n- Texto de i\nii. Dos');
    expect(r.raiz[0].children.map((c) => c.nombre)).toEqual(['Texto de i', 'Dos']);
  });

  it('ignores the bullet in front of a labeled line ("- a. Foo")', () => {
    const r = parsearTexto('1. Uno\n- a. Foo\n- b. Bar');
    expect(r.raiz[0].children.map((c) => c.etiqueta)).toEqual(['a.', 'b.']);
  });
});
