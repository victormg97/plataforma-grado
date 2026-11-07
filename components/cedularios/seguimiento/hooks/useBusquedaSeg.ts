'use client';

import { useDebouncedValue } from '@/components/cedularios/hooks/useDebouncedValue';
import {
  SEG_BUSQUEDA_DEBOUNCE_MS,
  SEG_BUSQUEDA_MAX,
} from '@/lib/cedularios/seguimiento/constants';

/**
 * Search text ready to be part of a query key: debounced (300 ms), trimmed and capped at
 * 100 characters. Blank input becomes an empty string, which means "no filter".
 * Used by the read hooks that take a search text, so typing does not fire a query per key.
 */
export function useBusquedaSeg(q: string | null | undefined): string {
  const debounced = useDebouncedValue(q ?? '', SEG_BUSQUEDA_DEBOUNCE_MS);
  return debounced.trim().slice(0, SEG_BUSQUEDA_MAX);
}
