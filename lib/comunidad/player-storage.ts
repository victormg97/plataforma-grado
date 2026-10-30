/**
 * Per-player browser storage for the game (survives page reloads).
 *
 * Keys are namespaced by user id so two people sharing a browser never see
 * each other's quiz attempts, drafts or "already seen" flags. Values are
 * wrapped with a timestamp so stale entries expire. All access is guarded:
 * private mode / disabled storage just behaves as "nothing saved".
 */

interface Envelope<T> {
  v: T;
  t: number;
}

type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function playerKey(userId: string, name: string): string {
  return `ce:${userId}:${name}`;
}

export function readPlayerItem<T>(
  key: string,
  { maxAgeMs, kind = 'local' }: { maxAgeMs?: number; kind?: StorageKind } = {}
): T | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (maxAgeMs !== undefined && Date.now() - env.t > maxAgeMs) {
      storage.removeItem(key);
      return null;
    }
    return env.v;
  } catch {
    return null;
  }
}

export function writePlayerItem<T>(key: string, value: T, kind: StorageKind = 'local') {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ v: value, t: Date.now() } satisfies Envelope<T>));
  } catch {
    // Quota exceeded / disabled: losing the backup is harmless.
  }
}

export function removePlayerItem(key: string, kind: StorageKind = 'local') {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}
