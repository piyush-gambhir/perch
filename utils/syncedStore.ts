/**
 * A small list store that mirrors data into browser.storage.sync so it follows the
 * user across devices, while keeping browser.storage.local as the always-available
 * source of truth.
 *
 * Correctness guarantees:
 *  - Atomic read-modify-write across contexts via Web Locks (see mutateSynced).
 *  - A monotonic `rev` (epoch ms) is stored in BOTH areas; load returns whichever
 *    copy is newer. This prevents a STALE sync copy from shadowing a fresher local
 *    one when a sync write was skipped on quota, while still letting another device's
 *    newer sync write win.
 *  - Chunks are written before stale chunks are removed, so `meta.count` never points
 *    at a missing chunk.
 *
 * storage.sync limits: ~8 KB/item, 100 KB total, 512 items. The list is JSON-encoded
 * and split across numbered chunk keys; if it exceeds the quota the sync mirror is
 * skipped (caught) and local still holds everything.
 */

import { browser } from 'wxt/browser';
import { withLock } from './locks';

// storage.sync's QUOTA_BYTES_PER_ITEM (8192) is measured on the JSON stringification
// of the value in UTF-8 bytes — so a chunk's quotes/backslashes count double and CJK
// chars count 3+. Budget well under 8192 to leave room for the key name and the
// stringification's surrounding quotes.
const CHUNK_BYTES = 7000;
// 100 KB total sync quota shared across all keys; bail out early past ~84 KB.
const MAX_CHUNKS = 12;

/** JSON-escaped UTF-8 byte length of one code point inside a JSON string. */
function escapedByteLength(code: number): number {
  if (code === 0x22 || code === 0x5c) return 2; // " or \ → \" or \\
  if (code < 0x20) return 6; // control chars → \uXXXX (worst case)
  if (code <= 0x7f) return 1;
  if (code <= 0x7ff) return 2;
  if (code <= 0xffff) return 3;
  return 4;
}

/**
 * Split a string into pieces of at most `maxBytes` JSON-escaped UTF-8 bytes each,
 * never splitting a surrogate pair. Pure.
 */
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

/** Reassemble chunks produced by chunkString. Pure. */
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

    // Write the new payload (meta + chunks) FIRST so meta never references missing chunks.
    const payload: Record<string, unknown> = { [metaKey(key)]: { count: chunks.length, rev } };
    chunks.forEach((c, i) => (payload[chunkKey(key, i)] = c));
    await sync.set(payload);

    // Then prune now-orphaned trailing chunks from a previous, larger write.
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

/**
 * Read both copies and pick a winner by rev. When the sync copy is strictly newer,
 * persist it back into local: otherwise a device that later goes offline falls back
 * to its stale local copy, and the next mutation re-uploads that stale list —
 * permanently deleting whatever the other device had synced.
 */
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

/** Load a list, returning whichever of {local, sync} is newer (by rev). */
export async function loadSynced<T>(key: string): Promise<T[]> {
  // Locked so the local write-back can't race a concurrent mutateSynced write.
  return withLock(`perch-store:${key}`, async () => (await loadNewest<T>(key)).items);
}

/** Save a list: stamp a new rev, write local (source of truth), then mirror to sync. */
async function saveWithRev<T>(key: string, items: T[], baseRev: number): Promise<void> {
  // Monotonic past the base rev, so a device with a slow wall clock can't produce
  // a write that an older copy immediately shadows.
  const rev = Math.max(Date.now(), baseRev + 1);
  await browser.storage.local.set({ [key]: items, [revKey(key)]: rev });
  await writeSync(key, items, rev);
}

/** Save a list (standalone). Prefer mutateSynced for read-modify-write. */
export async function saveSynced<T>(key: string, items: T[]): Promise<void> {
  return withLock(`perch-store:${key}`, async () => {
    const { rev } = await loadNewest<T>(key);
    await saveWithRev(key, items, rev);
  });
}

/**
 * Atomically read-modify-write a list under a cross-context lock. `transform` must be
 * pure and operate on the freshly-loaded list, so concurrent writers (page + service
 * worker) merge instead of clobbering.
 */
export async function mutateSynced<T>(key: string, transform: (items: T[]) => T[]): Promise<T[]> {
  return withLock(`perch-store:${key}`, async () => {
    const { items, rev } = await loadNewest<T>(key);
    const next = transform(items);
    await saveWithRev(key, next, rev);
    return next;
  });
}

/** Subscribe to changes for this key in either storage area. Returns unsubscribe. */
export function onSyncedChanged(key: string, cb: () => void): () => void {
  // A save writes local then sync, arriving as two separate change events; coalesce
  // them into one callback so subscribers don't refetch and re-render twice.
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
