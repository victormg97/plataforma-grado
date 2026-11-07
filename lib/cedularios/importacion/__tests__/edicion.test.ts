import { describe, expect, it } from 'vitest';
import { aplanarArbol } from '../arbol';
import { agregar, ancestrosDe, desindentar, eliminar, fusionarConAnterior, mover, renombrar, sangrar } from '../edicion';
import type { NodoImportacion } from '../tipos';

function nodo(key: string, nombre: string, children: NodoImportacion[] = []): NodoImportacion {
  return { key, etiqueta: null, nombre, codigo: '', children, lineaOrigen: 1 };
}

function base(): NodoImportacion[] {
  return [nodo('a', 'A', [nodo('a1', 'A1')]), nodo('b', 'B'), nodo('c', 'C')];
}

const codigos = (raiz: NodoImportacion[]) => aplanarArbol(raiz).map((m) => `${m.key}=${m.codigo}`);

describe('edicion', () => {
  it('does not mutate the input and returns the same instance on no-op', () => {
    const raiz = base();
    const copia = JSON.stringify(raiz);
    expect(sangrar(raiz, 'a')).toBe(raiz);
    expect(renombrar(raiz, 'b', 'B2')).not.toBe(raiz);
    expect(JSON.stringify(raiz)).toBe(copia);
  });

  it('indents under the previous sibling and recomputes codes', () => {
    expect(codigos(sangrar(base(), 'b'))).toEqual(['a=1', 'a1=1.1', 'b=1.2', 'c=2']);
  });

  it('outdents after the parent', () => {
    expect(codigos(desindentar(base(), 'a1'))).toEqual(['a=1', 'a1=2', 'b=3', 'c=4']);
  });

  it('moves among siblings and ignores the edges', () => {
    expect(codigos(mover(base(), 'c', -1))).toEqual(['a=1', 'a1=1.1', 'c=2', 'b=3']);
    const raiz = base();
    expect(mover(raiz, 'a', -1)).toBe(raiz);
  });

  it('deletes with descendants', () => {
    expect(codigos(eliminar(base(), 'a'))).toEqual(['b=1', 'c=2']);
  });

  it('merges with the previous sibling', () => {
    const r = fusionarConAnterior(base(), 'b');
    expect(r[0].nombre).toBe('A B');
    expect(r).toHaveLength(2);
  });

  it('adds sibling and child', () => {
    expect(codigos(agregar(base(), 'a', 'x', false))).toEqual(['a=1', 'a1=1.1', 'x=2', 'b=3', 'c=4']);
    expect(codigos(agregar(base(), 'a', 'x', true))).toEqual(['a=1', 'a1=1.1', 'x=1.2', 'b=2', 'c=3']);
  });

  it('lists ancestors', () => {
    expect(ancestrosDe(base(), 'a1')).toEqual(['a']);
    expect(ancestrosDe(base(), 'a')).toEqual([]);
  });
});
