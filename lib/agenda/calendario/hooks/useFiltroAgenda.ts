'use client';

/**
 * Slice `calendario` — hook del Filtro_Agenda (Requisito 12.3).
 *
 * Lee y escribe el query param `agenda` usando `useQueryParam`, parseando
 * con `parsearFiltro` y serializando con `serializarFiltro`.
 */

import { useCallback } from 'react';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { parsearFiltro, serializarFiltro, type FiltroAgenda } from '../filtro';

/**
 * Hook que gestiona el estado del Filtro_Agenda a través del query param `agenda`.
 *
 * @returns Una tupla `[filtro, setFiltro]` donde:
 *   - `filtro` es el estado actual (los tres tipos o un subconjunto activo).
 *   - `setFiltro` persiste el nuevo filtro en la URL.
 */
export function useFiltroAgenda(): [FiltroAgenda, (filtro: FiltroAgenda) => void] {
  const [valor, setValor] = useQueryParam('agenda');

  const filtro = parsearFiltro(valor);

  const setFiltro = useCallback(
    (nuevoFiltro: FiltroAgenda) => {
      setValor(serializarFiltro(nuevoFiltro));
    },
    [setValor],
  );

  return [filtro, setFiltro];
}
