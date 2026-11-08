'use client';
/**
 * Browser Back guard for an overlay with unsaved progress (see `lib/cedularios/seguimiento/back-guard.ts`).
 *
 * While `enabled`, a sentinel history entry with the same URL sits on top of the current one, so
 * Back lands on the same URL (the overlay stays open), the sentinel is pushed again and `onBlocked`
 * runs (the host shows its "discard?" confirmation). Reload and tab close are covered by
 * `beforeunload` (generic browser dialog).
 *
 * The sentinel is pushed with `{ segBackGuard: true }` and never resends `window.history.state`:
 * Next's patched `pushState` copies its internal `__NA` keys into our object, so the entry stays
 * valid for the App Router and its own `popstate` handler just re-renders the same URL.
 *
 * `liberar(cb)` must wrap every programmatic close while the guard may be armed: it consumes the
 * sentinel first and runs `cb` (which clears `seg_*` with `replaceState`) once history settled, so
 * a later Back does not reopen an empty overlay.
 */
import { useCallback, useEffect, useRef } from 'react';
import { createBackGuard, type BackGuard } from '@/lib/cedularios/seguimiento/back-guard';

const SENTINEL_KEY = 'segBackGuard';

export interface UseBackGuardArgs {
  enabled: boolean;
  onBlocked: () => void;
}

export function useBackGuard({ enabled, onBlocked }: UseBackGuardArgs) {
  const guardRef = useRef<BackGuard | null>(null);
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  // One guard per mounted host (listener lives as long as the component).
  useEffect(() => {
    const guard = createBackGuard(
      {
        pushSentinel: () => {
          const { pathname, search, hash } = window.location;
          window.history.pushState({ [SENTINEL_KEY]: true }, '', `${pathname}${search}${hash}`);
        },
        isOnSentinel: () =>
          (window.history.state as Record<string, unknown> | null)?.[SENTINEL_KEY] === true,
        back: () => window.history.back(),
        onPop: (listener) => {
          window.addEventListener('popstate', listener);
          return () => window.removeEventListener('popstate', listener);
        },
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (handle) => window.clearTimeout(handle as number),
      },
      { onBlocked: () => onBlockedRef.current() },
    );
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
      guard.dispose();
    };
  }, []);

  // Arm while there is something to protect; release (without a callback) when progress is gone.
  useEffect(() => {
    const guard = guardRef.current;
    if (!guard) return;
    if (enabled) guard.arm();
    else if (guard.armed) guard.liberar(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a returnValue to show the dialog
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);

  const liberar = useCallback((callback: () => void) => {
    const guard = guardRef.current;
    if (guard) guard.liberar(callback);
    else callback();
  }, []);

  return { liberar };
}
