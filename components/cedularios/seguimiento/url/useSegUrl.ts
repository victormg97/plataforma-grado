'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SEG_ESTADO_VACIO,
  aplicarSegPatch,
  parseSegState,
  type SegModal,
  type SegState,
} from '@/lib/cedularios/seguimiento/url';
import {
  resolverSegInvalido,
  type DatosValidacionSeg,
} from '@/lib/cedularios/seguimiento/resolver-url';

export interface SegAbrirArgs {
  modal: SegModal;
  alumno?: string | null;
  cedulario?: string | null;
  materia?: string | null;
}

export interface UseSegUrlResult {
  /** Normalized `seg_*` state, derived from the current query string. */
  estado: SegState;
  /** Opens a modal. Params not given are cleared and filter/search are reset. */
  abrir: (args: SegAbrirArgs) => void;
  /** Removes every `seg_*` param. */
  cerrar: () => void;
  /** Applies a partial patch to the `seg_*` params only. */
  fijar: (parche: Partial<SegState>) => void;
  /** Fixes an inconsistent state (see `resolverSegInvalido`). Returns true if the URL changed. */
  limpiarInvalidos: (datos: DatosValidacionSeg) => boolean;
}

/**
 * Reads the `seg_*` state with `useSearchParams` (a source shared by every
 * component, so all instances agree) and writes it with `history.replaceState`.
 * Next patches `replaceState`, so `useSearchParams` updates without a server
 * round trip. Never uses `router.push` nor `useShallowQueryParam`.
 * Browser back does not close the overlay because only `replaceState` is used.
 */
export function useSegUrl(): UseSegUrlResult {
  const searchParams = useSearchParams();
  const consulta = searchParams?.toString() ?? '';

  const estado = useMemo<SegState>(
    () => (consulta === '' ? SEG_ESTADO_VACIO : parseSegState(consulta)),
    [consulta],
  );

  /** Applies a patch on top of the live URL; returns true if the URL changed. */
  const escribir = useCallback((parche: Partial<SegState>): boolean => {
    if (typeof window === 'undefined') return false;
    const { pathname, search, hash } = window.location;
    // Read the live query (not the render snapshot) so consecutive writes do not overwrite each other.
    const actual = search.startsWith('?') ? search.slice(1) : search;
    const siguiente = aplicarSegPatch(actual, parche);
    if (siguiente === actual) return false;
    const url = `${pathname}${siguiente ? `?${siguiente}` : ''}${hash}`;
    window.history.replaceState(window.history.state, '', url);
    return true;
  }, []);

  const abrir = useCallback(
    ({ modal, alumno = null, cedulario = null, materia = null }: SegAbrirArgs) => {
      escribir({ modal, alumno, cedulario, materia, filtro: 'todas', q: '' });
    },
    [escribir],
  );

  const cerrar = useCallback(() => {
    escribir({
      modal: null,
      alumno: null,
      cedulario: null,
      materia: null,
      filtro: 'todas',
      q: '',
    });
  }, [escribir]);

  const fijar = useCallback(
    (parche: Partial<SegState>) => {
      escribir(parche);
    },
    [escribir],
  );

  const limpiarInvalidos = useCallback(
    (datos: DatosValidacionSeg): boolean => {
      const parche = resolverSegInvalido(estado, datos);
      if (Object.keys(parche).length === 0) return false;
      return escribir(parche);
    },
    [estado, escribir],
  );

  return useMemo(
    () => ({ estado, abrir, cerrar, fijar, limpiarInvalidos }),
    [estado, abrir, cerrar, fijar, limpiarInvalidos],
  );
}
