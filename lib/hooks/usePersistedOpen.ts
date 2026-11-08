'use client';

import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'persisted-open-change';

function read(key: string, defaultOpen: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // storage unavailable (private mode, etc.)
  }
  return defaultOpen;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * Open/closed state persisted in localStorage under `key`.
 * SSR-safe (renders `defaultOpen` on the server and during hydration).
 * Pass `key = null` to disable persistence (e.g. while the user is not loaded yet).
 */
export function usePersistedOpen(key: string | null, defaultOpen = true) {
  const open = useSyncExternalStore(
    subscribe,
    () => (key ? read(key, defaultOpen) : defaultOpen),
    () => defaultOpen,
  );

  const setOpen = useCallback(
    (next: boolean) => {
      if (!key) return;
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // ignore quota/private-mode errors
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [open, setOpen] as const;
}
