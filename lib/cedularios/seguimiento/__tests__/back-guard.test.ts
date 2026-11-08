import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  BACK_GUARD_FALLBACK_MS,
  createBackGuard,
  type BackGuard,
} from '../back-guard';

/**
 * Minimal model of the browser history: a stack of entries, an index, and `back()` that fires
 * `popstate` asynchronously (here: when `flush()` is called), like a real traversal.
 */
class FakeBrowser {
  entries: { sentinel: boolean }[] = [{ sentinel: false }]; // [0] = page A (the one with seg_*)
  index = 0;
  /** True once Back moved the user below A (left the page). */
  exited = false;
  private listeners: (() => void)[] = [];
  private pops = 0;
  private timers: { id: number; at: number; fn: () => void }[] = [];
  private now = 0;
  private nextId = 1;
  blocked = 0;

  pushSentinel = () => {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ sentinel: true });
    this.index += 1;
  };

  isOnSentinel = () => this.entries[this.index].sentinel;

  back = () => {
    if (this.index === 0) {
      this.exited = true;
      return;
    }
    this.index -= 1;
    this.pops += 1;
  };

  onPop = (fn: () => void) => {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  };

  setTimeout = (fn: () => void, ms: number) => {
    const id = this.nextId++;
    this.timers.push({ id, at: this.now + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown) => {
    this.timers = this.timers.filter((t) => t.id !== handle);
  };

  /** Delivers the pending popstate events. */
  flush() {
    while (this.pops > 0) {
      this.pops -= 1;
      for (const l of [...this.listeners]) l();
    }
  }

  advance(ms: number) {
    this.now += ms;
    const due = this.timers.filter((t) => t.at <= this.now).sort((a, b) => a.at - b.at);
    this.timers = this.timers.filter((t) => t.at > this.now);
    for (const t of due) t.fn();
  }

  /** The user presses the browser Back button and the event is delivered. */
  backUser() {
    this.back();
    this.flush();
  }

  get sentinels() {
    return this.entries.slice(0, this.index + 1).filter((e) => e.sentinel).length;
  }
}

function crear() {
  const browser = new FakeBrowser();
  const guard = createBackGuard(browser, {
    onBlocked: () => {
      browser.blocked += 1;
    },
  });
  return { browser, guard };
}

describe('createBackGuard', () => {
  it('without arming, Back is not intercepted', () => {
    const { browser } = crear();
    browser.backUser();
    expect(browser.blocked).toBe(0);
    expect(browser.exited).toBe(true);
  });

  it('arm pushes one sentinel and is idempotent', () => {
    const { browser, guard } = crear();
    guard.arm();
    guard.arm();
    expect(browser.entries).toHaveLength(2);
    expect(browser.sentinels).toBe(1);
  });

  it('Back while armed stays on the page, re-arms and reports the block', () => {
    const { browser, guard } = crear();
    guard.arm();
    browser.backUser();
    expect(browser.exited).toBe(false);
    expect(browser.blocked).toBe(1);
    expect(browser.index).toBe(1);
    expect(browser.sentinels).toBe(1);
    browser.backUser();
    expect(browser.blocked).toBe(2);
    expect(browser.exited).toBe(false);
  });

  it('liberar consumes the sentinel and runs the callback once on the pop', () => {
    const { browser, guard } = crear();
    guard.arm();
    let calls = 0;
    guard.liberar(() => {
      calls += 1;
    });
    expect(calls).toBe(0);
    browser.flush();
    browser.advance(BACK_GUARD_FALLBACK_MS * 2);
    expect(calls).toBe(1);
    expect(browser.index).toBe(0);
    expect(browser.sentinels).toBe(0);
    expect(browser.blocked).toBe(0);
  });

  it('liberar falls back to the timeout when no pop arrives', () => {
    const { browser, guard } = crear();
    guard.arm();
    let calls = 0;
    guard.liberar(() => {
      calls += 1;
    });
    browser.advance(BACK_GUARD_FALLBACK_MS - 1);
    expect(calls).toBe(0);
    browser.advance(1);
    expect(calls).toBe(1);
  });

  it('liberar without arming runs the callback immediately and does not touch history', () => {
    const { browser, guard } = crear();
    let calls = 0;
    guard.liberar(() => {
      calls += 1;
    });
    expect(calls).toBe(1);
    expect(browser.entries).toHaveLength(1);
    expect(browser.exited).toBe(false);
  });

  it('dispose consumes a live sentinel and stops listening', () => {
    const { browser, guard } = crear();
    guard.arm();
    guard.dispose();
    browser.flush();
    expect(browser.index).toBe(0);
    expect(browser.blocked).toBe(0);
  });
});

type Cmd = 'arm' | 'backUser' | 'liberar' | 'flush' | 'advance';

describe('createBackGuard (properties)', () => {
  it('never leaves the page while armed, never leaves sentinels after release, callbacks run once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Cmd>('arm', 'backUser', 'liberar', 'flush', 'advance'), {
          maxLength: 40,
        }),
        (cmds) => {
          const { browser, guard }: { browser: FakeBrowser; guard: BackGuard } = crear();
          let liberaciones = 0;
          let callbacks = 0;
          for (const cmd of cmds) {
            const armadoAntes = guard.armed;
            const blockedAntes = browser.blocked;
            if (cmd === 'arm') {
              const sentinelsAntes = browser.sentinels;
              guard.arm();
              // (d) arming twice never duplicates the sentinel
              expect(browser.sentinels).toBeLessThanOrEqual(Math.max(1, sentinelsAntes));
            } else if (cmd === 'backUser') {
              if (!armadoAntes && browser.index === 0) continue; // would leave the page: not modelled here
              browser.backUser();
              // (c) when not armed, Back never calls onBlocked
              if (!armadoAntes) expect(browser.blocked).toBe(blockedAntes);
            } else if (cmd === 'liberar') {
              liberaciones += 1;
              guard.liberar(() => {
                callbacks += 1;
              });
            } else if (cmd === 'flush') {
              browser.flush();
            } else {
              browser.advance(BACK_GUARD_FALLBACK_MS);
            }
            // (a) with progress (armed) the user is never below page A
            if (guard.armed) {
              expect(browser.exited).toBe(false);
              expect(browser.index).toBe(1);
            }
          }
          // settle everything
          browser.flush();
          browser.advance(BACK_GUARD_FALLBACK_MS * 2);
          browser.flush();
          // (b) every release ran its callback exactly once and left no sentinel behind
          expect(callbacks).toBe(liberaciones);
          if (!guard.armed) expect(browser.sentinels).toBe(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});
