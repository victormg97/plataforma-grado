'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Like useQueryParam, but updates the URL WITHOUT triggering a Next.js App
 * Router navigation. `router.replace('?x=..')` re-runs the route's Server
 * Component (and any server-side prefetch) on every change, which makes tab
 * switching slow (~1s) even when the data is already cached.
 *
 * This hook keeps the active value in local state (instant), and mirrors it to
 * the URL via history.replaceState so it stays shareable / back-button aware,
 * without any RSC round-trip. Reads the initial value from the current URL and
 * listens for popstate to stay in sync with browser navigation.
 */
export function useShallowQueryParam(
  key: string,
  defaultValue: string | null = null
) {
  const read = useCallback((): string | null => {
    if (typeof window === 'undefined') return defaultValue;
    return new URLSearchParams(window.location.search).get(key) ?? defaultValue;
  }, [key, defaultValue]);

  const [value, setValue] = useState<string | null>(read);

  // Keep in sync with browser back/forward.
  useEffect(() => {
    const onPop = () => setValue(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read]);

  const set = useCallback(
    (newValue: string | null) => {
      setValue(newValue);
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      if (newValue === null) params.delete(key);
      else params.set(key, newValue);
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      // replaceState: updates the address bar without an App Router navigation.
      window.history.replaceState(window.history.state, '', url);
    },
    [key]
  );

  return [value, set] as const;
}
