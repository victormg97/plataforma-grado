/**
 * Pure search and filter helpers for the cedularios module (no React, no Supabase).
 *
 * - buscarEnArbol: materia matches (código, nombre, descripción + server temario matches),
 *   the ancestors to expand, and the result count (Requirement 14.7, 14.8, 14.10, 14.11)
 * - resaltar: splits a text into matched and unmatched segments (Requirement 14.9)
 * - filtrarCedularios: list filter by text and universidad (Requirement 14.2, 14.5)
 *
 * All functions are total and never mutate their input.
 */

import type { MateriaNodo } from './tree';

/** Maximum length of both search inputs (Requirement 14.1, 14.6). */
export const SEARCH_MAX_LENGTH = 100;

/** Delay after the last keystroke before a search is applied (Requirement 14.3). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Row of the cedularios list: universidad name and creator joined, no rich text. */
export interface CedularioListItem {
  id: string;
  nombre: string;
  version: string;
  universidadId: string;
  universidadNombre: string;
  universidadLogoUrl: string | null;
  updated_at: string;
  activo: boolean;
  createdBy: string | null;
}

export interface ResultadoBusqueda {
  /** Ids of the matching active materias. */
  coincidencias: Set<string>;
  /** Ids of every ancestor of every match (the matches themselves are not included). */
  expandir: Set<string>;
  /** Number of matches, equal to `coincidencias.size`. */
  total: number;
}

export interface SegmentoTexto {
  texto: string;
  coincide: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').toLowerCase();
}

function contiene(texto: string | null | undefined, consultaNormalizada: string): boolean {
  return normalizar(texto).includes(consultaNormalizada);
}

/**
 * Lowercased `texto` plus, for every UTF-16 unit of the lowercased string, the index of the
 * original unit it came from (`origen`, with one extra trailing entry equal to `texto.length`).
 * Lowercasing can change the length (e.g. "İ"), so offsets in the lowercased string cannot be
 * used on the original directly.
 */
function minusculasConMapa(texto: string): { bajo: string; origen: number[] } {
  const bajo = texto.toLowerCase();
  const origen: number[] = [];
  if (bajo.length === texto.length) {
    for (let i = 0; i <= texto.length; i++) origen.push(i);
    return { bajo, origen };
  }
  let acumulado = '';
  let i = 0;
  while (i < texto.length) {
    const cp = texto.codePointAt(i) as number;
    const unidad = String.fromCodePoint(cp);
    const minuscula = unidad.toLowerCase();
    for (let k = 0; k < minuscula.length; k++) origen.push(i);
    acumulado += minuscula;
    i += unidad.length;
  }
  origen.push(texto.length);
  return { bajo: acumulado, origen };
}

// ---------------------------------------------------------------------------
// Materias tree search
// ---------------------------------------------------------------------------

/**
 * Matches are the active materias whose código, nombre or descripción contains the trimmed
 * query (case-insensitive), plus the active materias whose id is in `idsTemarioCoincidentes`
 * (the server-side temario search). `expandir` holds every ancestor of every match.
 * An empty or whitespace-only query yields no matches and nothing to expand.
 */
export function buscarEnArbol(
  flat: MateriaNodo[],
  q: string,
  idsTemarioCoincidentes: ReadonlySet<string>,
): ResultadoBusqueda {
  const consulta = normalizar(q.trim());
  const coincidencias = new Set<string>();
  const expandir = new Set<string>();
  if (consulta === '') return { coincidencias, expandir, total: 0 };

  for (const n of flat) {
    if (!n.activo) continue;
    if (
      contiene(n.codigo, consulta) ||
      contiene(n.nombre, consulta) ||
      contiene(n.descripcion, consulta) ||
      idsTemarioCoincidentes.has(n.id)
    ) {
      coincidencias.add(n.id);
    }
  }

  if (coincidencias.size > 0) {
    const porId = new Map<string, MateriaNodo>();
    for (const n of flat) porId.set(n.id, n);
    for (const id of coincidencias) {
      // Same walk as `ancestros` in tree.ts, sharing one id index across all matches.
      let actual = porId.get(id);
      while (actual && actual.parentId !== null && !expandir.has(actual.parentId)) {
        const padre = porId.get(actual.parentId);
        if (!padre || padre.id === id) break;
        expandir.add(padre.id);
        actual = padre;
      }
    }
  }

  return { coincidencias, expandir, total: coincidencias.size };
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

/**
 * Splits `texto` into consecutive segments that concatenate to the original text. Segments
 * with `coincide: true` equal the trimmed query ignoring case; the others contain no
 * occurrence of it. An empty or whitespace-only query (or empty text) gives a single
 * unmatched segment, or no segments for an empty text.
 */
export function resaltar(texto: string, q: string): SegmentoTexto[] {
  if (texto === '') return [];
  const consulta = normalizar(q.trim());
  if (consulta === '') return [{ texto, coincide: false }];

  const { bajo, origen } = minusculasConMapa(texto);
  const segmentos: SegmentoTexto[] = [];
  let cursor = 0; // position in the original text up to which segments were emitted
  let desde = 0; // search position in the lowercased text

  for (;;) {
    const inicio = bajo.indexOf(consulta, desde);
    if (inicio < 0) break;
    const fin = inicio + consulta.length;
    const inicioOriginal = origen[inicio];
    const finOriginal = origen[fin];
    // Skip matches that would split an original character.
    const alineado =
      (inicio === 0 || origen[inicio - 1] !== inicioOriginal) &&
      (fin === bajo.length || origen[fin - 1] !== finOriginal);
    if (!alineado || inicioOriginal < cursor) {
      desde = inicio + 1;
      continue;
    }
    if (inicioOriginal > cursor) {
      segmentos.push({ texto: texto.slice(cursor, inicioOriginal), coincide: false });
    }
    segmentos.push({ texto: texto.slice(inicioOriginal, finOriginal), coincide: true });
    cursor = finOriginal;
    desde = fin;
  }

  if (cursor < texto.length) segmentos.push({ texto: texto.slice(cursor), coincide: false });
  return segmentos;
}

// ---------------------------------------------------------------------------
// Cedularios list filter
// ---------------------------------------------------------------------------

/**
 * Keeps the cedularios whose nombre, versión or universidad nombre contains the trimmed
 * query (case-insensitive) and, when `universidadId` is set, that belong to that universidad.
 * An empty query matches every cedulario. The input order is preserved.
 */
export function filtrarCedularios(
  items: CedularioListItem[],
  q: string,
  universidadId: string | null,
): CedularioListItem[] {
  const consulta = normalizar(q.trim());
  return items.filter((c) => {
    if (universidadId !== null && c.universidadId !== universidadId) return false;
    if (consulta === '') return true;
    return (
      contiene(c.nombre, consulta) ||
      contiene(c.version, consulta) ||
      contiene(c.universidadNombre, consulta)
    );
  });
}
