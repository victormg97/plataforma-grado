'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * In-app navigation guard for the mini-app. A view (e.g. the quiz in progress)
 * registers a "dirty" blocker; when the user tries to navigate away, the guard
 * intercepts and asks the host to confirm. A native beforeunload handler is the
 * safety net for real page reloads / tab close (F5), where only the browser's
 * generic dialog is possible.
 */
type Blocker = { active: boolean; message?: string };

interface NavGuardContextValue {
  /** Register/update the current blocker (call with active=false to clear). */
  setBlocker: (blocker: Blocker) => void;
  /** Run an action, prompting first if a blocker is active. */
  guardedRun: (action: () => void) => void;
}

const NavGuardContext = createContext<NavGuardContextValue | null>(null);

export function GameNavGuardProvider({
  children,
  onConfirmNeeded,
}: {
  children: ReactNode;
  /** Asked to confirm leaving; receives the proceed callback. */
  onConfirmNeeded: (proceed: () => void) => void;
}) {
  const blockerRef = useRef<Blocker>({ active: false });

  const setBlocker = useCallback((blocker: Blocker) => {
    blockerRef.current = blocker;
  }, []);

  const guardedRun = useCallback(
    (action: () => void) => {
      if (blockerRef.current.active) {
        onConfirmNeeded(action);
      } else {
        action();
      }
    },
    [onConfirmNeeded]
  );

  // Native safety net for reload / tab close.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (blockerRef.current.active) {
        e.preventDefault();
        // Deprecated but still required by some browsers to trigger the dialog.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <NavGuardContext.Provider value={{ setBlocker, guardedRun }}>
      {children}
    </NavGuardContext.Provider>
  );
}

export function useGameNavGuard(): NavGuardContextValue {
  const ctx = useContext(NavGuardContext);
  // No provider (defensive): behave as a no-op guard.
  if (!ctx) {
    return {
      setBlocker: () => {},
      guardedRun: (action: () => void) => action(),
    };
  }
  return ctx;
}

/**
 * Registers a dirty blocker for the lifetime of the calling component (or while
 * `dirty` is true). Clears the blocker on unmount.
 */
export function useUnsavedChangesBlocker(dirty: boolean, message?: string) {
  const { setBlocker } = useGameNavGuard();

  useEffect(() => {
    setBlocker({ active: dirty, message });
    return () => setBlocker({ active: false });
  }, [dirty, message, setBlocker]);
}
