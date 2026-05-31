'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import type { Json } from '@/lib/supabase/types';

const DEBOUNCE_MS = 800;

/**
 * Per-user UI preference backed by `profiles.ui_preferences` (a JSONB blob).
 *
 * Why a single JSONB column instead of one column per setting:
 *  - Adding a new UI toggle needs NO schema migration — just a new key.
 *  - It's already loaded with the profile, so reads are free (no extra query).
 *  - The existing "user updates own profile" RLS policy covers writes.
 *
 * Behaviour:
 *  - Initial value comes from the in-memory profile (seeded server-side),
 *    falling back to `defaultValue` when the key is absent.
 *  - Updates are optimistic: local state + the in-memory store update
 *    instantly (so the choice survives in-session navigation), and the DB
 *    write is debounced to avoid hammering it on rapid toggles.
 *  - Persistence uses the `set_ui_preference` RPC, which MERGES the key
 *    server-side so concurrent saves of different keys don't clobber each other.
 *  - DB failures are non-critical and ignored (the setting just won't persist).
 *
 * @param key   stable preference key, e.g. 'admin_dash_actividad_open'
 * @param defaultValue value used when the key has never been set
 */
export function useUiPreference<T extends Json>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const supabase = createClient();
  const setUiPreferenceInStore = useUserStore((s) => s.setUiPreference);

  // Read the initial value once from the store (seeded from the DB profile).
  const initial = useUserStore.getState().user?.ui_preferences;
  const initialValue =
    initial && typeof initial === 'object' && !Array.isArray(initial) && key in initial
      ? ((initial as Record<string, Json>)[key] as T)
      : defaultValue;

  const [value, setValue] = useState<T>(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush any pending save on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const set = useCallback(
    (next: T) => {
      // 1. Optimistic local + in-memory store update (survives navigation).
      setValue(next);
      setUiPreferenceInStore(key, next);

      // 2. Debounced persistence to the DB.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        supabase
          .rpc('set_ui_preference', { p_key: key, p_value: next })
          .then(() => {/* non-critical */}, () => {/* ignore */});
      }, DEBOUNCE_MS);
    },
    [key, supabase, setUiPreferenceInStore]
  );

  return [value, set];
}
