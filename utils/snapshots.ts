import { browser } from 'wxt/browser';
import { uid } from './id';
import { withLock } from './locks';
import { isInternalUrl, openUrls } from './tabs';
import type { Snapshot, StashedTab } from './types';

const KEY = 'snapshots';
const LIMIT = 24;
const MIN_INTERVAL = 10 * 60_000;

export async function getSnapshots(): Promise<Snapshot[]> {
  const result = (await browser.storage.local.get(KEY)) as { snapshots?: Snapshot[] };
  return Array.isArray(result.snapshots) ? result.snapshots : [];
}

/**
 * Every snapshot write is a read-modify-write of one list, done from both the page
 * and the service worker, so all of them run under this cross-context lock.
 */
const mutateSnapshots = <T>(fn: () => Promise<T>) => withLock(`perch-store:${KEY}`, fn);

export async function captureSnapshot(
  reason: Snapshot['reason'] = 'manual',
  force = false,
): Promise<Snapshot | null> {
  return mutateSnapshots(async () => {
    const existing = await getSnapshots();
    const latest = existing[0];
    if (!force && latest && Date.now() - Date.parse(latest.createdAt) < MIN_INTERVAL) return null;
    const tabs = await browser.tabs.query({});
    const byWindow = new Map<number | undefined, StashedTab[]>();
    for (const tab of tabs) {
      if (!tab.url || tab.incognito || isInternalUrl(tab.url)) continue;
      const list = byWindow.get(tab.windowId) ?? [];
      list.push({
        url: tab.url,
        title: tab.title || tab.url,
        pinned: tab.pinned || undefined,
      });
      byWindow.set(tab.windowId, list);
    }
    const snapshot: Snapshot = {
      id: uid(),
      createdAt: new Date().toISOString(),
      reason,
      windows: [...byWindow].map(([windowId, windowTabs]) => ({ windowId, tabs: windowTabs })),
    };
    if (snapshot.windows.every((window) => window.tabs.length === 0)) return null;
    await browser.storage.local.set({ [KEY]: [snapshot, ...existing].slice(0, LIMIT) });
    return snapshot;
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  await mutateSnapshots(async () => {
    await browser.storage.local.set({
      [KEY]: (await getSnapshots()).filter((snapshot) => snapshot.id !== id),
    });
  });
}

export async function restoreSnapshot(id: string): Promise<number> {
  const snapshot = (await getSnapshots()).find((item) => item.id === id);
  if (!snapshot) return 0;
  const open = new Set(
    (await browser.tabs.query({})).map((tab) => tab.url).filter((url): url is string => !!url),
  );
  let restored = 0;
  for (const window of snapshot.windows) {
    const missing = window.tabs.filter((tab) => !open.has(tab.url));
    if (!missing.length) continue;
    const created = await browser.windows.create({});
    await openUrls(
      missing.map((tab) => tab.url),
      created?.id,
    );
    restored += missing.length;
    missing.forEach((tab) => open.add(tab.url));
  }
  return restored;
}

export function onSnapshotsChanged(callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && KEY in changes) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
