'use client';

import { useCallback, useMemo } from 'react';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';

/**
 * URL state of the cedularios module (Requirement 10.7, 10.8, 10.10, 10.11).
 *
 * Built on `useShallowQueryParam`: values are mirrored to the address bar with
 * `history.replaceState`, so there is no App Router navigation and query params
 * that do not start with `ced_` are left untouched.
 *
 * Several updates in the same tick do not overwrite each other: each setter of
 * `useShallowQueryParam` rebuilds the query string from the current
 * `window.location.search`, which the previous `replaceState` call already updated.
 */

export const PARAM_UNIVERSIDAD = 'ced_uni';
export const PARAM_CEDULARIO = 'ced_id';
export const PARAM_TAB = 'ced_tab';
export const PARAM_MATERIA = 'ced_materia';
export const PARAM_BUSQUEDA = 'ced_q';
export const PARAM_FILTRO_UNIVERSIDAD = 'ced_filtro_uni';
export const PARAM_MODAL = 'ced_modal';
/** Root level view: `universidades` (default) or `cedularios` (every cedulario). */
export const PARAM_VISTA = 'ced_vista';

export const CED_PARAMS = [
  PARAM_UNIVERSIDAD,
  PARAM_CEDULARIO,
  PARAM_TAB,
  PARAM_MATERIA,
  PARAM_BUSQUEDA,
  PARAM_FILTRO_UNIVERSIDAD,
  PARAM_MODAL,
  PARAM_VISTA,
] as const;

export type CedParam = (typeof CED_PARAMS)[number];

export const CED_VISTAS = ['universidades', 'cedularios'] as const;

export type CedulariosVista = (typeof CED_VISTAS)[number];

export const DEFAULT_VISTA: CedulariosVista = 'universidades';

export function esVistaValida(valor: unknown): valor is CedulariosVista {
  return typeof valor === 'string' && (CED_VISTAS as readonly string[]).includes(valor);
}

export const CEDULARIO_TABS = [
  'estructura',
  'normativa',
  'rubrica',
  'enlaces',
  'permisos',
  'historial',
] as const;

export type CedulariosTab = (typeof CEDULARIO_TABS)[number];

export const DEFAULT_TAB: CedulariosTab = 'estructura';

export function esTabValido(valor: unknown): valor is CedulariosTab {
  return typeof valor === 'string' && (CEDULARIO_TABS as readonly string[]).includes(valor);
}

/**
 * Parameters removed together with a parameter that points to a missing record.
 * `ced_materia` depends on `ced_id`, and `ced_id` depends on `ced_uni`. `ced_tab` is a
 * cedulario-level view, so it is dropped with the cedulario as well.
 */
const DEPENDIENTES: Readonly<Partial<Record<CedParam, readonly CedParam[]>>> = {
  [PARAM_UNIVERSIDAD]: [PARAM_CEDULARIO, PARAM_TAB, PARAM_MATERIA],
  [PARAM_CEDULARIO]: [PARAM_TAB, PARAM_MATERIA],
};

/** Parameter plus every parameter that depends on it. */
export function parametrosAfectados(param: CedParam): CedParam[] {
  return [param, ...(DEPENDIENTES[param] ?? [])];
}

const nulo = (valor: string | null): string | null => (valor === '' ? null : valor);

export interface CedulariosUrlState {
  universidadId: string | null;
  cedularioId: string | null;
  /** Always a valid tab: an unknown value in the URL reads as the default. */
  tab: CedulariosTab;
  materiaId: string | null;
  q: string;
  filtroUniversidadId: string | null;
  modal: string | null;
  /** Root level view; an unknown value in the URL reads as the default. */
  vista: CedulariosVista;

  /** Selecting a universidad clears the cedulario, its tab and the open materia. */
  setUniversidadId: (id: string | null) => void;
  /** Selecting a cedulario clears the open materia and resets the tab to the default. */
  setCedularioId: (id: string | null) => void;
  setTab: (tab: CedulariosTab) => void;
  setMateriaId: (id: string | null) => void;
  setQ: (q: string) => void;
  setFiltroUniversidadId: (id: string | null) => void;
  setModal: (modal: string | null) => void;
  /** Switches the root level view. Changing view drops the search text and the universidad filter. */
  setVista: (vista: CedulariosVista) => void;

  /** Closes the open materia panel. */
  clearMateria: () => void;
  /** Back to the cedularios list of the current universidad (clears ced_id, ced_tab, ced_materia). */
  clearCedulario: () => void;
  /** Removes every `ced_` parameter. */
  resetAll: () => void;
  /** Removes `param` and every parameter that depends on it (Requirement 10.11). */
  clearInvalid: (param: CedParam) => void;
}

export function useCedulariosUrlState(): CedulariosUrlState {
  const [uni, setUni] = useShallowQueryParam(PARAM_UNIVERSIDAD);
  const [cedId, setCedId] = useShallowQueryParam(PARAM_CEDULARIO);
  const [tabRaw, setTabRaw] = useShallowQueryParam(PARAM_TAB);
  const [materia, setMateria] = useShallowQueryParam(PARAM_MATERIA);
  const [q, setQRaw] = useShallowQueryParam(PARAM_BUSQUEDA);
  const [filtroUni, setFiltroUni] = useShallowQueryParam(PARAM_FILTRO_UNIVERSIDAD);
  const [modal, setModalRaw] = useShallowQueryParam(PARAM_MODAL);
  const [vistaRaw, setVistaRaw] = useShallowQueryParam(PARAM_VISTA);

  const setters = useMemo<Record<CedParam, (valor: string | null) => void>>(
    () => ({
      [PARAM_UNIVERSIDAD]: setUni,
      [PARAM_CEDULARIO]: setCedId,
      [PARAM_TAB]: setTabRaw,
      [PARAM_MATERIA]: setMateria,
      [PARAM_BUSQUEDA]: setQRaw,
      [PARAM_FILTRO_UNIVERSIDAD]: setFiltroUni,
      [PARAM_MODAL]: setModalRaw,
      [PARAM_VISTA]: setVistaRaw,
    }),
    [setUni, setCedId, setTabRaw, setMateria, setQRaw, setFiltroUni, setModalRaw, setVistaRaw],
  );

  const limpiar = useCallback(
    (params: readonly CedParam[]) => {
      for (const p of params) setters[p](null);
    },
    [setters],
  );

  const setUniversidadId = useCallback(
    (id: string | null) => {
      limpiar(DEPENDIENTES[PARAM_UNIVERSIDAD] ?? []);
      setUni(nulo(id));
    },
    [limpiar, setUni],
  );

  const setCedularioId = useCallback(
    (id: string | null) => {
      limpiar(DEPENDIENTES[PARAM_CEDULARIO] ?? []);
      setCedId(nulo(id));
    },
    [limpiar, setCedId],
  );

  const setTab = useCallback(
    (tab: CedulariosTab) => {
      // The default tab is not written to the URL.
      setTabRaw(tab === DEFAULT_TAB ? null : tab);
    },
    [setTabRaw],
  );

  const setMateriaId = useCallback((id: string | null) => setMateria(nulo(id)), [setMateria]);
  const setQ = useCallback((valor: string) => setQRaw(valor === '' ? null : valor), [setQRaw]);
  const setFiltroUniversidadId = useCallback(
    (id: string | null) => setFiltroUni(nulo(id)),
    [setFiltroUni],
  );
  const setModal = useCallback((valor: string | null) => setModalRaw(nulo(valor)), [setModalRaw]);

  const setVista = useCallback(
    (vista: CedulariosVista) => {
      // The search text and the universidad filter belong to one view: start the other one clean.
      setQRaw(null);
      setFiltroUni(null);
      setVistaRaw(vista === DEFAULT_VISTA ? null : vista);
    },
    [setQRaw, setFiltroUni, setVistaRaw],
  );

  const clearMateria = useCallback(() => setMateria(null), [setMateria]);
  const clearCedulario = useCallback(() => limpiar(parametrosAfectados(PARAM_CEDULARIO)), [limpiar]);
  const resetAll = useCallback(() => limpiar(CED_PARAMS), [limpiar]);
  const clearInvalid = useCallback((param: CedParam) => limpiar(parametrosAfectados(param)), [limpiar]);

  return {
    universidadId: nulo(uni),
    cedularioId: nulo(cedId),
    tab: esTabValido(tabRaw) ? tabRaw : DEFAULT_TAB,
    materiaId: nulo(materia),
    q: q ?? '',
    filtroUniversidadId: nulo(filtroUni),
    modal: nulo(modal),
    vista: esVistaValida(vistaRaw) ? vistaRaw : DEFAULT_VISTA,
    setUniversidadId,
    setCedularioId,
    setTab,
    setMateriaId,
    setQ,
    setFiltroUniversidadId,
    setModal,
    setVista,
    clearMateria,
    clearCedulario,
    resetAll,
    clearInvalid,
  };
}
