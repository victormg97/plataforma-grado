/**
 * Pure logic of the browser Back guard of the assign wizard (no React, no `window`).
 *
 * Why a sentinel: the App Router has no route-change guard and the `popstate` event cannot be
 * cancelled. The only way to keep the user on the page is to make sure that Back lands on an entry
 * that has the same URL as the current one:
 *
 *   [A]            -> arm()                ->  [A, S]   (S = sentinel, same URL as A)
 *   Back from S    -> lands on A, we push S again and report `onBlocked` (the host asks to confirm)
 *   liberar(cb)    -> history.back() (S -> A), and `cb` runs once that pop settles
 *
 * While armed the user is always on S, so Back never leaves the page. When there is nothing to
 * protect the guard is not armed and Back behaves as usual.
 */

/** Browser-facing side effects, injected so the logic can be tested with a fake history. */
export interface BackGuardEnv {
  /** Pushes a sentinel entry with the same URL as the current one. */
  pushSentinel: () => void;
  /** True when the current history entry is a sentinel pushed by `pushSentinel`. */
  isOnSentinel: () => boolean;
  /** `history.back()`. */
  back: () => void;
  /** Subscribes to `popstate`; returns the unsubscribe function. */
  onPop: (listener: () => void) => () => void;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface BackGuardOptions {
  /** Called when the user pressed Back while armed (the sentinel has already been re-pushed). */
  onBlocked: () => void;
}

export interface BackGuard {
  /** Pushes the sentinel once. Idempotent while armed. */
  arm: () => void;
  /**
   * Disarms the guard (consuming the sentinel) and runs `callback` exactly once when the history
   * has settled. If the guard is not armed, runs `callback` right away.
   */
  liberar: (callback: () => void) => void;
  /** Removes the listener; consumes the sentinel if it is still there. */
  dispose: () => void;
  readonly armed: boolean;
}

/** Fallback when the browser does not report the pop caused by `back()`. */
export const BACK_GUARD_FALLBACK_MS = 150;

export function createBackGuard(env: BackGuardEnv, options: BackGuardOptions): BackGuard {
  let armed = false;
  let pendiente: { callback: () => void; timer: unknown } | null = null;

  const terminarLiberacion = () => {
    if (pendiente === null) return;
    const { callback, timer } = pendiente;
    pendiente = null;
    env.clearTimeout(timer);
    callback();
  };

  const quitarListener = env.onPop(() => {
    if (pendiente !== null) {
      terminarLiberacion();
      return;
    }
    // Still on a sentinel: a late pop (its release already settled by the fallback) or a
    // duplicated event. Nothing to protect.
    if (!armed || env.isOnSentinel()) return;
    // Back landed on the entry below the sentinel: put the sentinel back and ask the user.
    env.pushSentinel();
    options.onBlocked();
  });

  return {
    get armed() {
      return armed;
    },
    arm() {
      if (armed || pendiente !== null) return;
      env.pushSentinel();
      armed = true;
    },
    liberar(callback) {
      if (pendiente !== null) {
        // A release is already in flight: chain the new callback after the previous one.
        const previo = pendiente.callback;
        pendiente.callback = () => {
          previo();
          callback();
        };
        return;
      }
      if (!armed) {
        callback();
        return;
      }
      armed = false;
      pendiente = { callback, timer: env.setTimeout(terminarLiberacion, BACK_GUARD_FALLBACK_MS) };
      env.back();
    },
    dispose() {
      quitarListener();
      if (pendiente !== null) {
        env.clearTimeout(pendiente.timer);
        pendiente = null;
      }
      if (armed) {
        armed = false;
        env.back();
      }
    },
  };
}
