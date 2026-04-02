'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

const STORAGE_KEY = 'cta_dl_rl';
const WINDOW_MS = 30_000; // 30 seconds per window
const MAX_PER_WINDOW = 3; // max 3 downloads per window

// Lock durations (ms) per escalation level
const LOCK_DURATIONS: [number, number, number, number] = [
  0,             // level 0: no lock (normal state)
  2 * 60_000,    // level 1: 2 minutes
  5 * 60_000,    // level 2: 5 minutes
  10 * 60_000,   // level 3: 10 minutes
];

interface RateLimitState {
  level: number;
  unlocksAt: number | null;
  count: number;
  windowStart: number;
}

function hydrate(): RateLimitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RateLimitState;
  } catch {
    // ignore parse errors — return clean state
  }
  return { level: 0, unlocksAt: null, count: 0, windowStart: Date.now() };
}

function persist(s: RateLimitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

export interface UseDownloadRateLimitReturn {
  /** Whether the user is currently locked out */
  isLocked: boolean;
  /** Seconds remaining until the lock expires (0 if not locked) */
  remainingSeconds: number;
  /** Escalation level (0–3). Higher = longer locks. */
  level: number;
  /**
   * Call before starting a download.
   * Returns true if the download is allowed, false if rate-limited.
   */
  attemptDownload: () => boolean;
}

export function useDownloadRateLimit(): UseDownloadRateLimitReturn {
  const [state, setState] = useState<RateLimitState>(hydrate);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-unlock: set timer to clear lock when it expires
  useEffect(() => {
    if (!state.unlocksAt) return;
    const remaining = state.unlocksAt - Date.now();
    if (remaining <= 0) {
      const next: RateLimitState = { ...state, unlocksAt: null, count: 0 };
      setState(next);
      persist(next);
      return;
    }
    const id = setTimeout(() => {
      const latest = stateRef.current;
      const next: RateLimitState = { ...latest, unlocksAt: null, count: 0 };
      setState(next);
      persist(next);
    }, remaining);
    return () => clearTimeout(id);
  }, [state.unlocksAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every second while locked to keep remainingSeconds countdown accurate
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!state.unlocksAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, [state.unlocksAt]);

  // Derived lock status — computed inside useMemo so Date.now() is not
  // called directly during render (avoids React's pure-render lint rule).
  const { isLocked, remainingSeconds } = useMemo(() => {
    const now = Date.now();
    const locked = !!state.unlocksAt && state.unlocksAt > now;
    return {
      isLocked: locked,
      remainingSeconds: locked ? Math.ceil((state.unlocksAt! - now) / 1_000) : 0,
    };
  // `tick` is intentionally included to refresh the countdown each second.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.unlocksAt, tick]);

  /** Returns true if download is allowed; false (and escalates lock) if rate-limited. */
  const attemptDownload = useCallback((): boolean => {
    const s = stateRef.current;
    const ts = Date.now();

    // Still under active lock?
    if (s.unlocksAt && ts < s.unlocksAt) return false;

    // Reset window if expired
    const windowExpired = ts - s.windowStart > WINDOW_MS;
    const count = windowExpired ? 1 : s.count + 1;
    const windowStart = windowExpired ? ts : s.windowStart;

    if (count > MAX_PER_WINDOW) {
      // Escalate: level goes up (max 3), apply corresponding lock
      const newLevel = Math.min(s.level + 1, LOCK_DURATIONS.length - 1) as 0 | 1 | 2 | 3;
      const next: RateLimitState = {
        level: newLevel,
        unlocksAt: ts + LOCK_DURATIONS[newLevel],
        count,
        windowStart,
      };
      setState(next);
      persist(next);
      return false;
    }

    const next: RateLimitState = { ...s, count, windowStart, unlocksAt: null };
    setState(next);
    persist(next);
    return true;
  }, []); // reads from ref — intentionally stable

  return { isLocked, remainingSeconds, attemptDownload, level: state.level };
}
