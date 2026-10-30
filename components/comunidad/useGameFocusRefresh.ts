'use client';

import { useEffect, useRef } from 'react';
import { useRefreshGameState } from '@/lib/hooks/useComunidad';
import type { GameStatePart } from '@/lib/comunidad/game-state';

// Re-sync after the tab was hidden at least this long.
const MIN_HIDDEN_MS = 45_000;

const PARTS: readonly GameStatePart[] = [
  'profile',
  'daily_question',
  'daily_review',
  'challenges',
  'badges',
  'weekly_case',
];

/** Calendar date in the game's timezone (streaks/daily question use it). */
function santiagoDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

/**
 * Keeps the game fresh with ONE request when the player comes back to the
 * tab (instead of every mounted query refetching on its own), and right away
 * when the day changed while the tab stayed open (new Pregunta del Día,
 * streak at risk/lost). Game queries opt out of refetchOnWindowFocus.
 */
export function useGameFocusRefresh(includeRanking: boolean) {
  const refresh = useRefreshGameState();
  const hiddenAtRef = useRef<number | null>(null);
  const dayRef = useRef<string>(santiagoDay());

  useEffect(() => {
    const run = () => {
      dayRef.current = santiagoDay();
      void refresh(includeRanking ? [...PARTS, 'ranking'] : PARTS).catch(() => {
        // Network hiccup: the next focus or interaction retries.
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      if (hiddenFor >= MIN_HIDDEN_MS || santiagoDay() !== dayRef.current) run();
    };

    // Midnight while the tab is visible: check once a minute (cheap, no I/O).
    const dayTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && santiagoDay() !== dayRef.current) run();
    }, 60_000);

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(dayTimer);
    };
  }, [refresh, includeRanking]);
}
