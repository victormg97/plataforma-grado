'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const DEBOUNCE_MS = 1500;
const VALID_DB_THEMES = ['light', 'dark', 'graduado'] as const;
type DbTheme = (typeof VALID_DB_THEMES)[number];

function isValidDbTheme(t: string): t is DbTheme {
  return (VALID_DB_THEMES as readonly string[]).includes(t);
}

// Module-level flag: true once the DB preference has been applied for this
// browser session. Persists across dashboard remounts (e.g. navigating to
// /terminos and back), so we never overwrite the user's in-session theme choice.
let dbThemeApplied = false;

/**
 * Syncs the active next-themes theme to `profiles.tema` in the DB (debounced).
 *
 * - `initialTema`: the value from DB when the dashboard first loaded.
 *   Applied only once per session so it doesn't override the user's theme
 *   when the dashboard layout remounts (e.g. after visiting a non-dashboard page).
 * - After the initial sync, any user-driven theme change is saved to DB
 *   after DEBOUNCE_MS of inactivity.
 * - `esGraduado`: when false, the 'graduado' theme is not accessible. If the
 *   active theme is 'graduado' and this is false, it resets to 'light'.
 */
export function useThemeSync(initialTema: string | null, esGraduado = false) {
  const { theme, setTheme } = useTheme();
  const skipNext = useRef(true); // skip the initial programmatic setTheme call
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  // Reset to 'light' if the graduado theme is active but access was revoked.
  useEffect(() => {
    if (!esGraduado && theme === 'graduado') {
      setTheme('light');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esGraduado]);

  // Apply the DB preference only on the first mount of this session.
  // Re-mounts caused by navigating away and back do NOT reset the theme.
  useEffect(() => {
    if (!dbThemeApplied && initialTema && isValidDbTheme(initialTema)) {
      // Only restore 'graduado' if the student still has access
      if (initialTema === 'graduado' && !esGraduado) {
        setTheme('light');
      } else {
        setTheme(initialTema);
      }
      dbThemeApplied = true;
    } else {
      // Already applied — skip the next effect tick so we don't save a stale value
      skipNext.current = false;
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
    if (!theme || !isValidDbTheme(theme)) return;

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
