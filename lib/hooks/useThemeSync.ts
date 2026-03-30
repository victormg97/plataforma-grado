'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const DEBOUNCE_MS = 1500;

/**
 * Syncs the active next-themes theme to `profiles.tema` in the DB (debounced).
 *
 * - `initialTema`: the value from DB when the dashboard first loaded.
 *   If non-null it is applied immediately so the user's saved preference wins.
 * - After the initial sync, any user-driven theme change is saved to DB
 *   after DEBOUNCE_MS of inactivity.
 */
export function useThemeSync(initialTema: string | null) {
  const { theme, setTheme } = useTheme();
  const skipNext = useRef(true); // skip the initial programmatic setTheme call
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  // Apply the DB preference once on mount (overrides localStorage)
  useEffect(() => {
    if (initialTema && (initialTema === 'light' || initialTema === 'dark')) {
      setTheme(initialTema);
    }
    mounted.current = true;
    // Give the programmatic setTheme above a tick before we start watching changes
    const t = setTimeout(() => { skipNext.current = false; }, 100);
    return () => clearTimeout(t);
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce-save to DB whenever theme changes after mount
  useEffect(() => {
    if (!mounted.current) return;
    if (skipNext.current) { skipNext.current = false; return; }
    if (!theme || (theme !== 'light' && theme !== 'dark')) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: theme }),
      }).catch(() => {/* non-critical, ignore */});
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [theme]);
}
