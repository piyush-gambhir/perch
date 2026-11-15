









type Locks = {
  request: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
};

function webLocks(): Locks | null {
  const nav = globalThis.navigator as unknown as { locks?: Locks } | undefined;
  return nav && nav.locks && typeof nav.locks.request === 'function' ? nav.locks : null;
}

const chains = new Map<string, Promise<unknown>>();


export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = webLocks();
  if (locks) return locks.request(name, fn);


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
