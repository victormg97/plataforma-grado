'use client';

import { useDebounce } from '@/lib/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/lib/cedularios/busqueda';

/**
 * Value that follows `value` after `delay` ms without changes
 * (default `SEARCH_DEBOUNCE_MS`, Requirement 14.3).
 */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  return useDebounce(value, delay);
}
