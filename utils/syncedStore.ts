


















import { browser } from 'wxt/browser';
import { withLock } from './locks';





const CHUNK_BYTES = 7000;

const MAX_CHUNKS = 12;


function escapedByteLength(code: number): number {
  if (code === 0x22 || code === 0x5c) return 2;
  if (code < 0x20) return 6;
  if (code <= 0x7f) return 1;
  if (code <= 0x7ff) return 2;
  if (code <= 0xffff) return 3;
  return 4;
}





export function chunkString(s: string, maxBytes: number = CHUNK_BYTES): string[] {
  if (s.length === 0) return [];
  const out: string[] = [];
  let start = 0;
  let bytes = 0;
  let i = 0;
  while (i < s.length) {
    const code = s.codePointAt(i) as number;
    const width = code > 0xffff ? 2 : 1;
    const len = escapedByteLength(code);
    if (bytes + len > maxBytes && i > start) {
      out.push(s.slice(start, i));
      start = i;
      bytes = 0;
    }
    bytes += len;
    i += width;
  }
  out.push(s.slice(start));
  return out;
}


export function joinChunks(chunks: string[]): string {
  return chunks.join('');
}

const metaKey = (key: string) => `${key}__meta`;
const revKey = (key: string) => `${key}__rev`;
const chunkKey = (key: string, i: number) => `${key}__c${i}`;

interface SyncMeta {
  count: number;
  rev: number;
}

async function readSync<T>(key: string): Promise<{ items: T[]; rev: number } | null> {
  try {
    const metaRes = (await browser.storage.sync.get(metaKey(key))) as Record<string, SyncMeta>;
    const meta = metaRes[metaKey(key)];
    if (!meta || typeof meta.count !== 'number' || meta.count <= 0) return null;
    const keys = Array.from({ length: meta.count }, (_, i) => chunkKey(key, i));
    const stored = (await browser.storage.sync.get(keys)) as Record<string, string>;
    const chunks = keys.map((k) => stored[k] ?? '');
    return { items: JSON.parse(joinChunks(chunks)) as T[], rev: meta.rev ?? 0 };
  } catch {
    return null;
  }
}

async function writeSync<T>(key: string, items: T[], rev: number): Promise<boolean> {
  try {
    const sync = browser.storage.sync;
    const json = JSON.stringify(items);
    const chunks = chunkString(json);
    if (chunks.length > MAX_CHUNKS) return false;

    const prevRes = (await sync.get(metaKey(key))) as Record<string, SyncMeta>;
    const prevCount = prevRes[metaKey(key)]?.count ?? 0;


    const payload: Record<string, unknown> = { [metaKey(key)]: { count: chunks.length, rev } };
    chunks.forEach((c, i) => (payload[chunkKey(key, i)] = c));
    await sync.set(payload);


    if (prevCount > chunks.length) {
      const stale: string[] = [];
      for (let i = chunks.length; i < prevCount; i++) stale.push(chunkKey(key, i));
      await sync.remove(stale);
    }
    return true;
  } catch {
    return false;
  }
}

async function readLocal<T>(key: string): Promise<{ items: T[] | null; rev: number }> {
  try {
    const res = (await browser.storage.local.get([key, revKey(key)])) as Record<string, unknown>;
    const items = (res[key] as T[] | undefined) ?? null;
    const rev = typeof res[revKey(key)] === 'number' ? (res[revKey(key)] as number) : 0;
    return { items, rev };
  } catch {
    return { items: null, rev: 0 };
  }
}







async function loadNewest<T>(key: string): Promise<{ items: T[]; rev: number }> {
  const [local, sync] = await Promise.all([readLocal<T>(key), readSync<T>(key)]);
  if (sync && (local.items === null || sync.rev >= local.rev)) {
    if (sync.rev > local.rev) {
      await browser.storage.local
        .set({ [key]: sync.items, [revKey(key)]: sync.rev })
        .catch(() => {});
    }
    return { items: sync.items, rev: sync.rev };
  }
  if (local.items !== null) return { items: local.items, rev: local.rev };
  return { items: [], rev: 0 };
}


export async function loadSynced<T>(key: string): Promise<T[]> {

  return withLock(`perch-store:${key}`, async () => (await loadNewest<T>(key)).items);
}


async function saveWithRev<T>(key: string, items: T[], baseRev: number): Promise<void> {


  const rev = Math.max(Date.now(), baseRev + 1);
  await browser.storage.local.set({ [key]: items, [revKey(key)]: rev });
  await writeSync(key, items, rev);
}


export async function saveSynced<T>(key: string, items: T[]): Promise<void> {
  return withLock(`perch-store:${key}`, async () => {
    const { rev } = await loadNewest<T>(key);
    await saveWithRev(key, items, rev);
  });
}






export async function mutateSynced<T>(key: string, transform: (items: T[]) => T[]): Promise<T[]> {
  return withLock(`perch-store:${key}`, async () => {
    const { items, rev } = await loadNewest<T>(key);
    const next = transform(items);
    await saveWithRev(key, next, rev);
    return next;
  });
}


export function onSyncedChanged(key: string, cb: () => void): () => void {


  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      cb();
    }, 25);
  };
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && key in changes) fire();
    else if (area === 'sync' && metaKey(key) in changes) fire();
  };
  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
    if (timer) clearTimeout(timer);
  };
}
