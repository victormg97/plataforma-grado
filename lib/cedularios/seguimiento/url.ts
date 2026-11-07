/**
 * URL state of the per-student tracking (phase 2): the `seg_*` query params.
 * Pure module: no React, no Supabase, no browser globals.
 *
 * - `parseSegState` normalizes whatever is in the query to a valid state.
 * - `aplicarSegPatch` rewrites only `seg_*` params and keeps every other
 *   param byte for byte (no re-encoding), so `ced_*`, `from`, `tab`, etc. survive.
 */

import { SEG_BUSQUEDA_MAX } from './constants';
import type { SegFiltro } from './filtros';

export const SEG_PARAMS = [
  'seg_modal',
  'seg_alumno',
  'seg_cedulario',
  'seg_materia',
  'seg_filtro',
  'seg_q',
] as const;

export type SegParam = (typeof SEG_PARAMS)[number];

export const SEG_MODALES = ['revision', 'asignar', 'editar_materias'] as const;
export type SegModal = (typeof SEG_MODALES)[number];

export const SEG_FILTROS = ['todas', 'pendientes', 'cubiertas', 'repasadas'] as const;

export interface SegState {
  modal: SegModal | null;
  alumno: string | null;
  cedulario: string | null;
  materia: string | null;
  filtro: SegFiltro;
  q: string;
}

/** State used when the query has no (valid) `seg_*` params. */
export const SEG_ESTADO_VACIO: SegState = {
  modal: null,
  alumno: null,
  cedulario: null,
  materia: null,
  filtro: 'todas',
  q: '',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esUuid = (valor: string | null | undefined): valor is string =>
  typeof valor === 'string' && UUID_RE.test(valor);

const esModal = (valor: string | null | undefined): valor is SegModal =>
  typeof valor === 'string' && (SEG_MODALES as readonly string[]).includes(valor);

const esFiltro = (valor: string | null | undefined): valor is SegFiltro =>
  typeof valor === 'string' && (SEG_FILTROS as readonly string[]).includes(valor);

/** Cuts the search text to the maximum length without leaving a lone surrogate. */
function recortarBusqueda(texto: string): string {
  if (texto.length <= SEG_BUSQUEDA_MAX) return texto;
  let corte = texto.slice(0, SEG_BUSQUEDA_MAX);
  const ultimo = corte.charCodeAt(corte.length - 1);
  if (ultimo >= 0xd800 && ultimo <= 0xdbff) corte = corte.slice(0, -1);
  return corte;
}

/** Parses the `seg_*` params. Invalid values are dropped (null or defaults). */
export function parseSegState(search: string | URLSearchParams): SegState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;

  const modal = params.get('seg_modal');
  const alumno = params.get('seg_alumno');
  const cedulario = params.get('seg_cedulario');
  const materia = params.get('seg_materia');
  const filtro = params.get('seg_filtro');
  const q = params.get('seg_q');

  return {
    modal: esModal(modal) ? modal : null,
    alumno: esUuid(alumno) ? alumno : null,
    cedulario: esUuid(cedulario) ? cedulario : null,
    materia: esUuid(materia) ? materia : null,
    filtro: esFiltro(filtro) ? filtro : 'todas',
    q: q === null ? '' : recortarBusqueda(q),
  };
}

/** Raw (still encoded) key of one `key=value` query segment. */
function claveDeSegmento(segmento: string): string {
  const igual = segmento.indexOf('=');
  return igual === -1 ? segmento : segmento.slice(0, igual);
}

/** Encoded `key=value` segment for a patch entry, or null when the param must be removed. */
function segmentoDePatch(clave: SegParam, patch: Partial<SegState>): string | null {
  switch (clave) {
    case 'seg_modal':
      return esModal(patch.modal) ? `seg_modal=${patch.modal}` : null;
    case 'seg_alumno':
      return esUuid(patch.alumno) ? `seg_alumno=${patch.alumno}` : null;
    case 'seg_cedulario':
      return esUuid(patch.cedulario) ? `seg_cedulario=${patch.cedulario}` : null;
    case 'seg_materia':
      return esUuid(patch.materia) ? `seg_materia=${patch.materia}` : null;
    case 'seg_filtro':
      // The default filter is never written.
      return esFiltro(patch.filtro) && patch.filtro !== 'todas' ? `seg_filtro=${patch.filtro}` : null;
    case 'seg_q': {
      if (typeof patch.q !== 'string') return null;
      const q = recortarBusqueda(patch.q);
      // An empty search is never written.
      return q === '' ? null : `seg_q=${encodeURIComponent(q)}`;
    }
  }
}

const CLAVE_DE_PATCH: Record<SegParam, keyof SegState> = {
  seg_modal: 'modal',
  seg_alumno: 'alumno',
  seg_cedulario: 'cedulario',
  seg_materia: 'materia',
  seg_filtro: 'filtro',
  seg_q: 'q',
};

/**
 * Applies a patch to a query string and returns the new query string, without
 * the leading `?` (the input may or may not have it).
 *
 * Only params named in the patch change: a null value (or an invalid one,
 * the default filter, or an empty search) removes the param. Every other
 * segment, `seg_*` or not, is kept verbatim and in its original order.
 * Patched params are appended at the end, in `SEG_PARAMS` order.
 */
export function aplicarSegPatch(search: string, patch: Partial<SegState>): string {
  const consulta = search.startsWith('?') ? search.slice(1) : search;

  const tocadas = new Set<SegParam>();
  for (const param of SEG_PARAMS) {
    if (patch[CLAVE_DE_PATCH[param]] !== undefined) tocadas.add(param);
  }

  const conservados = consulta
    .split('&')
    .filter((segmento) => segmento !== '')
    .filter((segmento) => !tocadas.has(claveDeSegmento(segmento) as SegParam));

  for (const param of SEG_PARAMS) {
    if (!tocadas.has(param)) continue;
    const nuevo = segmentoDePatch(param, patch);
    if (nuevo !== null) conservados.push(nuevo);
  }

  return conservados.join('&');
}
