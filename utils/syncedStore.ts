/**
 * A small list store that mirrors data into browser.storage.sync so it follows the
 * user across devices, while keeping browser.storage.local as the always-available
 * source of truth.
 *
 * storage.sync limits: 8 KB per item, 100 KB total, 512 items. We serialize a list
 * to JSON and split it across numbered chunk keys (each < 8 KB). If the data is too
 * large for the sync quota, the sync write is skipped (caught) and local still holds
 * everything — so the feature degrades gracefully instead of throwing.
 */

import { browser } from 'wxt/browser';

const CHUNK_SIZE = 6000; // bytes-ish per chunk string, safely under the 8 KB item cap
const MAX_CHUNKS = 80; // ~480 KB of JSON ceiling before we give up on sync

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
const chunkKey = (key: string, i: number) => `${key}__c${i}`;

async function readSync<T>(key: string): Promise<T[] | null> {
  try {
    const meta = (await browser.storage.sync.get(metaKey(key))) as Record<string, unknown>;
    const count = meta[metaKey(key)];
    if (typeof count !== 'number' || count <= 0) return null;
    const keys = Array.from({ length: count }, (_, i) => chunkKey(key, i));
    const stored = (await browser.storage.sync.get(keys)) as Record<string, string>;
    const chunks = keys.map((k) => stored[k] ?? '');
    return JSON.parse(joinChunks(chunks)) as T[];
  } catch {
    return null;
  }
}

async function writeSync<T>(key: string, items: T[]): Promise<boolean> {
  try {
    const sync = browser.storage.sync;
    const json = JSON.stringify(items);
    const chunks = chunkString(json);
    if (chunks.length > MAX_CHUNKS) return false; // too big for sync; keep local-only

    // Remove any stale chunks from a previous (larger) write.
    const prev = (await sync.get(metaKey(key))) as Record<string, unknown>;
    const prevCount = typeof prev[metaKey(key)] === 'number' ? (prev[metaKey(key)] as number) : 0;
    const staleKeys: string[] = [];
    for (let i = chunks.length; i < prevCount; i++) staleKeys.push(chunkKey(key, i));
    if (staleKeys.length) await sync.remove(staleKeys);

    const payload: Record<string, unknown> = { [metaKey(key)]: chunks.length };
    chunks.forEach((c, i) => (payload[chunkKey(key, i)] = c));
    await sync.set(payload);
    return true;
  } catch {
    return false; // over quota or sync unavailable — local remains the source of truth
  }
}

/** Load a list: prefer the synced copy (so other devices win), else local. */
export async function loadSynced<T>(key: string): Promise<T[]> {
  const fromSync = await readSync<T>(key);
  if (fromSync) return fromSync;
  try {
    const local = (await browser.storage.local.get(key)) as Record<string, T[] | undefined>;
    return local[key] ?? [];
  } catch {
    return [];
  }
}

/** Save a list: always write local (source of truth), then mirror to sync (best-effort). */
export async function saveSynced<T>(key: string, items: T[]): Promise<void> {
  await browser.storage.local.set({ [key]: items });
  await writeSync(key, items);
}

/** Subscribe to changes for this key in either storage area. Returns unsubscribe. */
export function onSyncedChanged(key: string, cb: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if ((area === 'local' && key in changes) || (area === 'sync' && metaKey(key) in changes)) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
