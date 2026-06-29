/**
 * Cross-context mutual exclusion for storage read-modify-write.
 *
 * The new-tab page and the service worker are separate JS contexts that can write
 * the same storage key concurrently (e.g. a user stashing while the hourly
 * auto-stash alarm fires). The Web Locks API (navigator.locks) is shared across
 * all of an extension's contexts, so it serializes those writes for real. When it
 * is unavailable we fall back to an in-context promise chain (better than nothing).
 */

type Locks = {
  request: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
};

function webLocks(): Locks | null {
  const nav = globalThis.navigator as unknown as { locks?: Locks } | undefined;
  return nav && nav.locks && typeof nav.locks.request === 'function' ? nav.locks : null;
}

const chains = new Map<string, Promise<unknown>>();

/** Run `fn` while holding an exclusive lock named `name`. */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = webLocks();
  if (locks) return locks.request(name, fn);

  // Fallback: serialize within this context only.
  const prev = chains.get(name) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const mine = prev.then(() => gate);
  chains.set(name, mine);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (chains.get(name) === mine) chains.delete(name);
  }
}
