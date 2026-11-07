/**
 * Tree builder for the cedulario importer. Pure and deterministic.
 *
 * Instead of fixing a depth per label style, the builder keeps a stack of the labels currently
 * open and places every new label by sequence:
 *   1. it continues a sequence on the stack (`b.` after `a.`, `iii.` after `ii.`): sibling;
 *   2. it starts a sequence (`1`, `a`, `i`) and the top of the stack is another family: child;
 *   3. otherwise (gap, repeated number): sibling of the nearest entry of the same family.
 * So the same family can appear at several depths (`1.` for sections and again deep inside
 * Compraventa) and `i.` is read as letter or roman numeral depending on where it is.
 *
 * Labels glued in the middle of a line (`2. Concepto 3. Evolución`) are split only when the
 * candidate label really continues or starts a sequence, so "artículo 1554" never splits.
 */

import {
  etiquetaAlInicio,
  siguienteEtiqueta,
  type CandidatoEtiqueta,
  type EtiquetaDetectada,
  type FamiliaEtiqueta,
} from './etiquetas';
import { normalizarNombre } from './limpieza';
import {
  LIMITES_IMPORTACION,
  type Advertencia,
  type LineaLimpia,
  type MateriaPlana,
  type NodoImportacion,
} from './tipos';

interface NodoMut {
  key: string;
  etiqueta: string | null;
  nombre: string;
  children: NodoMut[];
  lineaOrigen: number;
}

interface Entrada {
  familia: FamiliaEtiqueta;
  valor: number;
  nodo: NodoMut;
}

interface Colocacion {
  candidato: CandidatoEtiqueta;
  /** 3 = continues a sequence, 2 = starts one, 1 = gap/repeat, 0 = unknown family. */
  puntaje: number;
  /** Stack index the new entry will occupy (== stack length for a child of the top). */
  nivel: number;
  cercania: number;
}

/** Mid-line labels are only split when the next character looks like the start of a title. */
const INICIO_TITULO = /^[A-ZÁÉÍÓÚÑÜ0-9¿¡"«“(]/;
const FIN_FRASE = /[.:;!?]$/;
const INICIA_MAYUSCULA = /^[A-ZÁÉÍÓÚÑÜ¿¡"«“]/;

function evaluar(pila: readonly Entrada[], c: CandidatoEtiqueta): Colocacion {
  let cercania = -1;
  for (let i = pila.length - 1; i >= 0; i -= 1) {
    if (pila[i].familia === c.familia) {
      cercania = i;
      break;
    }
  }
  for (let i = pila.length - 1; i >= 0; i -= 1) {
    if (pila[i].familia === c.familia && pila[i].valor + 1 === c.valor) {
      return { candidato: c, puntaje: 3, nivel: i, cercania };
    }
  }
  const tope = pila[pila.length - 1];
  if (c.valor === 1 && (tope === undefined || tope.familia !== c.familia)) {
    return { candidato: c, puntaje: 2, nivel: pila.length, cercania };
  }
  if (cercania >= 0) return { candidato: c, puntaje: 1, nivel: cercania, cercania };
  return { candidato: c, puntaje: 0, nivel: pila.length, cercania };
}

function mejorColocacion(pila: readonly Entrada[], etiqueta: EtiquetaDetectada): Colocacion {
  let mejor: Colocacion | null = null;
  for (const c of etiqueta.candidatos) {
    const actual = evaluar(pila, c);
    if (
      mejor === null ||
      actual.puntaje > mejor.puntaje ||
      (actual.puntaje === mejor.puntaje && actual.cercania > mejor.cercania)
    ) {
      mejor = actual;
    }
  }
  // Detected labels always carry at least one candidate.
  return mejor as Colocacion;
}

export interface ResultadoArbol {
  raiz: NodoImportacion[];
  advertencias: Advertencia[];
  /** Lines before the first label: title, university, date. */
  prefacio: LineaLimpia[];
}

/**
 * Builds the tree from cleaned lines. Never throws. Text that cannot be attached to a label is
 * appended to the previous item (and reported) rather than dropped.
 */
export function construirArbol(lineas: readonly LineaLimpia[]): ResultadoArbol {
  const advertencias: Advertencia[] = [];
  const raiz: NodoMut[] = [];
  const pila: Entrada[] = [];
  const todos: NodoMut[] = [];
  let ultimo: NodoMut | null = null;
  let contador = 0;

  let primera = lineas.findIndex((l) => etiquetaAlInicio(l.texto) !== null);
  if (primera < 0) primera = lineas.length;
  const prefacio = lineas.slice(0, primera);

  const crear = (etiqueta: EtiquetaDetectada, linea: number): NodoMut => {
    const colocacion = mejorColocacion(pila, etiqueta);
    const nodo: NodoMut = {
      key: `n${(contador += 1)}`,
      etiqueta: etiqueta.texto,
      nombre: '',
      children: [],
      lineaOrigen: linea,
    };
    const { familia, valor } = colocacion.candidato;
    if (colocacion.puntaje <= 1) {
      advertencias.push({
        tipo: 'salto_numeracion',
        severidad: 'aviso',
        nodoKey: nodo.key,
        linea,
        params: { etiqueta: etiqueta.texto },
      });
    }
    pila.length = colocacion.nivel;
    const padre = colocacion.nivel > 0 ? pila[colocacion.nivel - 1].nodo : null;
    (padre === null ? raiz : padre.children).push(nodo);
    pila.push({ familia, valor, nodo });
    todos.push(nodo);
    ultimo = nodo;
    return nodo;
  };

  const agregarTexto = (nodo: NodoMut | null, trozo: string, linea: number): void => {
    const texto = trozo.trim();
    if (texto === '') return;
    const destino = nodo ?? ultimo;
    if (destino === null) return;
    if (destino.nombre === '') {
      destino.nombre = texto;
      return;
    }
    if (nodo === null && FIN_FRASE.test(destino.nombre) && INICIA_MAYUSCULA.test(texto)) {
      advertencias.push({ tipo: 'linea_sin_etiqueta', severidad: 'aviso', nodoKey: destino.key, linea });
    }
    destino.nombre = `${destino.nombre} ${texto}`;
  };

  for (let i = primera; i < lineas.length; i += 1) {
    const { texto, numero } = lineas[i];
    let actual: NodoMut | null = null;
    let inicioTexto = 0;

    const inicial = etiquetaAlInicio(texto);
    if (inicial !== null) {
      actual = crear(inicial, numero);
      inicioTexto = inicial.fin;
    }

    let busqueda = inicioTexto;
    for (;;) {
      const m = siguienteEtiqueta(texto, busqueda);
      if (m === null) break;
      busqueda = Math.max(m.fin, m.inicio + 1);
      if (m.inicio < inicioTexto || !INICIO_TITULO.test(texto.slice(m.fin, m.fin + 1))) continue;
      if (mejorColocacion(pila, m).puntaje < 2) continue;
      agregarTexto(actual, texto.slice(inicioTexto, m.inicio), numero);
      actual = crear(m, numero);
      inicioTexto = m.fin;
    }
    agregarTexto(actual, texto.slice(inicioTexto), numero);
  }

  for (const nodo of todos) {
    nodo.nombre = normalizarNombre(nodo.nombre);
    if (nodo.nombre === '') {
      nodo.nombre = nodo.etiqueta ?? '-';
      advertencias.push({
        tipo: 'nombre_relleno',
        severidad: 'aviso',
        nodoKey: nodo.key,
        linea: nodo.lineaOrigen,
      });
    }
  }

  const resultado = raiz as unknown as NodoImportacion[];
  recalcularCodigos(resultado);
  return { raiz: resultado, advertencias, prefacio };
}

/** Sets `codigo` of every node to the numeric path of its position (`2`, `2.1`, `2.1.3`). */
export function recalcularCodigos(raiz: NodoImportacion[]): void {
  const recorrer = (nodos: NodoImportacion[], prefijo: string): void => {
    nodos.forEach((nodo, indice) => {
      nodo.codigo = `${prefijo}${indice + 1}`;
      recorrer(nodo.children, `${nodo.codigo}.`);
    });
  };
  recorrer(raiz, '');
}

/** Flattens the tree depth-first (parents before children, siblings in order). */
export function aplanarArbol(raiz: readonly NodoImportacion[]): MateriaPlana[] {
  const salida: MateriaPlana[] = [];
  const recorrer = (nodos: readonly NodoImportacion[], padre: string | null, profundidad: number): void => {
    for (const n of nodos) {
      salida.push({
        key: n.key,
        parentKey: padre,
        depth: profundidad,
        codigo: n.codigo,
        nombre: n.nombre,
        etiqueta: n.etiqueta,
        lineaOrigen: n.lineaOrigen,
      });
      recorrer(n.children, n.key, profundidad + 1);
    }
  };
  recorrer(raiz, null, 1);
  return salida;
}

export function profundidadMaxima(raiz: readonly NodoImportacion[]): number {
  let max = 0;
  const recorrer = (nodos: readonly NodoImportacion[], nivel: number): void => {
    for (const n of nodos) {
      if (nivel > max) max = nivel;
      recorrer(n.children, nivel + 1);
    }
  };
  recorrer(raiz, 1);
  return max;
}

/** Limit re-exported for callers that only import this module. */
export const PROFUNDIDAD_MAXIMA = LIMITES_IMPORTACION.profundidad;
