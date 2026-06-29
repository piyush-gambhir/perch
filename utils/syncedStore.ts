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

const CHUNK_SIZE = 6000;
const MAX_CHUNKS = 80;

/** Split a string into <=size pieces. Pure. */
export function chunkString(s: string, size: number = CHUNK_SIZE): string[] {
  if (s.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
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

/** Load a list, returning whichever of {local, sync} is newer (by rev). */
export async function loadSynced<T>(key: string): Promise<T[]> {
  const [local, sync] = await Promise.all([readLocal<T>(key), readSync<T>(key)]);
  if (sync && (local.items === null || sync.rev >= local.rev)) return sync.items;
  if (local.items !== null) return local.items;
  if (sync) return sync.items;
  return [];
}

/** Save a list: stamp a new rev, write local (source of truth), then mirror to sync. */
export async function saveSynced<T>(key: string, items: T[]): Promise<void> {
  const rev = Date.now();
  await browser.storage.local.set({ [key]: items, [revKey(key)]: rev });
  await writeSync(key, items, rev);
}

/**
 * Atomically read-modify-write a list under a cross-context lock. `transform` must be
 * pure and operate on the freshly-loaded list, so concurrent writers (page + service
 * worker) merge instead of clobbering.
 */
export async function mutateSynced<T>(key: string, transform: (items: T[]) => T[]): Promise<T[]> {
  return withLock(`perch-store:${key}`, async () => {
    const items = await loadSynced<T>(key);
    const next = transform(items);
    await saveSynced(key, next);
    return next;
  });
}

/** Subscribe to changes for this key in either storage area. Returns unsubscribe. */
export function onSyncedChanged(key: string, cb: () => void): () => void {
  let queued = false;
  const fire = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      cb();
    });
  };
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && key in changes) fire();
    else if (area === 'sync' && metaKey(key) in changes) fire();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
