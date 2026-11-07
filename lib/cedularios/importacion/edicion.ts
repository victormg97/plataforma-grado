/**
 * Pure edit operations of the import review tree. Every function returns a NEW tree (the input
 * is never mutated) with the numeric `codigo` paths already recomputed. A no-op (for example
 * indenting the first sibling) returns the same array instance, so callers can detect it.
 */
import { recalcularCodigos } from './arbol';
import type { NodoImportacion } from './tipos';

interface Ubicacion {
  lista: NodoImportacion[];
  indice: number;
  padre: NodoImportacion | null;
}

function ubicar(
  lista: NodoImportacion[],
  key: string,
  padre: NodoImportacion | null = null,
): Ubicacion | null {
  for (let i = 0; i < lista.length; i += 1) {
    const nodo = lista[i];
    if (nodo.key === key) return { lista, indice: i, padre };
    const dentro = ubicar(nodo.children, key, nodo);
    if (dentro) return dentro;
  }
  return null;
}

function aplicar(
  raiz: readonly NodoImportacion[],
  key: string,
  fn: (u: Ubicacion, copia: NodoImportacion[]) => boolean,
): NodoImportacion[] {
  const copia = structuredClone(raiz) as NodoImportacion[];
  const u = ubicar(copia, key);
  if (!u || !fn(u, copia)) return raiz as NodoImportacion[];
  recalcularCodigos(copia);
  return copia;
}

/** Keys of the ancestors of `key`, root first (empty when it is a root item or missing). */
export function ancestrosDe(raiz: readonly NodoImportacion[], key: string): string[] {
  const visitar = (lista: readonly NodoImportacion[], ruta: string[]): string[] | null => {
    for (const n of lista) {
      if (n.key === key) return ruta;
      const r = visitar(n.children, [...ruta, n.key]);
      if (r) return r;
    }
    return null;
  };
  return visitar(raiz, []) ?? [];
}

export function renombrar(raiz: readonly NodoImportacion[], key: string, nombre: string): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    const nodo = u.lista[u.indice];
    if (nodo.nombre === nombre) return false;
    nodo.nombre = nombre;
    return true;
  });
}

/** Makes the item the last child of its previous sibling. */
export function sangrar(raiz: readonly NodoImportacion[], key: string): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    if (u.indice === 0) return false;
    const [nodo] = u.lista.splice(u.indice, 1);
    u.lista[u.indice - 1].children.push(nodo);
    return true;
  });
}

/** Makes the item the next sibling of its parent. */
export function desindentar(raiz: readonly NodoImportacion[], key: string): NodoImportacion[] {
  return aplicar(raiz, key, (u, copia) => {
    if (!u.padre) return false;
    const [nodo] = u.lista.splice(u.indice, 1);
    const abuelo = ubicar(copia, u.padre.key);
    if (!abuelo) return false;
    abuelo.lista.splice(abuelo.indice + 1, 0, nodo);
    return true;
  });
}

export function mover(raiz: readonly NodoImportacion[], key: string, delta: -1 | 1): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    const destino = u.indice + delta;
    if (destino < 0 || destino >= u.lista.length) return false;
    const [nodo] = u.lista.splice(u.indice, 1);
    u.lista.splice(destino, 0, nodo);
    return true;
  });
}

/** Removes the item with all its descendants. */
export function eliminar(raiz: readonly NodoImportacion[], key: string): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    u.lista.splice(u.indice, 1);
    return true;
  });
}

/**
 * Appends the item's name to the previous sibling and moves its children there
 * (for a line that was wrongly split in two).
 */
export function fusionarConAnterior(raiz: readonly NodoImportacion[], key: string): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    if (u.indice === 0) return false;
    const [nodo] = u.lista.splice(u.indice, 1);
    const previo = u.lista[u.indice - 1];
    previo.nombre = `${previo.nombre} ${nodo.nombre}`.trim();
    previo.children.push(...nodo.children);
    return true;
  });
}

/** Adds an empty item right after `key` as sibling, or as last child when `comoHijo`. */
export function agregar(
  raiz: readonly NodoImportacion[],
  key: string,
  nuevaKey: string,
  comoHijo: boolean,
): NodoImportacion[] {
  return aplicar(raiz, key, (u) => {
    const nuevo: NodoImportacion = { key: nuevaKey, etiqueta: null, nombre: '', codigo: '', children: [], lineaOrigen: 0 };
    if (comoHijo) u.lista[u.indice].children.push(nuevo);
    else u.lista.splice(u.indice + 1, 0, nuevo);
    return true;
  });
}

/** Adds an empty first-level item at the end (for an empty tree). */
export function agregarRaiz(raiz: readonly NodoImportacion[], nuevaKey: string): NodoImportacion[] {
  const copia = structuredClone(raiz) as NodoImportacion[];
  copia.push({ key: nuevaKey, etiqueta: null, nombre: '', codigo: '', children: [], lineaOrigen: 0 });
  recalcularCodigos(copia);
  return copia;
}
