/**
 * Workspaces — named tab contexts you switch between. The workspace list is synced;
 * the active-workspace id is local (it's about *this* device's current window).
 *
 * Switching: capture the current open tabs into the active workspace, then open the
 * target workspace's tabs and close the current ones. Because the current tabs are
 * saved into their workspace first, nothing is lost — switching back restores them.
 */

import { browser } from 'wxt/browser';
import { uid } from './id';
import { withLock } from './locks';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import { isInternalUrl, openUrls } from './tabs';
import type { StashedTab, Workspace } from './types';

const WS_KEY = 'workspaces';
const ACTIVE_KEY = 'activeWorkspace';

export async function getWorkspaces(): Promise<Workspace[]> {
  return loadSynced<Workspace>(WS_KEY);
}

export async function createWorkspace(name: string, tabs: StashedTab[] = []): Promise<Workspace> {
  const ws: Workspace = { id: uid(), name: name.trim() || 'Workspace', tabs };
  await mutateSynced<Workspace>(WS_KEY, (list) => [...list, ws]);
  return ws;
}

/** Create a "Default" workspace iff none exist — atomically, so concurrent contexts
 *  (multiple new-tab pages, StrictMode double-mount) can't seed duplicates. */
export async function seedDefaultIfEmpty(): Promise<{
  list: Workspace[];
  seededId: string | null;
}> {
  let seededId: string | null = null;
  const list = await mutateSynced<Workspace>(WS_KEY, (cur) => {
    if (cur.length > 0) return cur;
    const def: Workspace = { id: uid(), name: 'Default', tabs: [] };
    seededId = def.id;
    return [def];
  });
  return { list, seededId };
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  await mutateSynced<Workspace>(WS_KEY, (list) =>
    list.map((w) => (w.id === id ? { ...w, name: name.trim() || w.name } : w)),
  );
}

export async function deleteWorkspace(id: string): Promise<void> {
  await mutateSynced<Workspace>(WS_KEY, (list) => list.filter((w) => w.id !== id));
}

/** Replace a workspace's captured tabs (used when switching away from it). */
export async function setWorkspaceTabs(id: string, tabs: StashedTab[]): Promise<void> {
  await mutateSynced<Workspace>(WS_KEY, (list) =>
    list.map((w) => (w.id === id ? { ...w, tabs } : w)),
  );
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  try {
    const res = (await browser.storage.local.get(ACTIVE_KEY)) as { activeWorkspace?: string };
    return res.activeWorkspace ?? null;
  } catch {
    return null;
  }
}

export async function setActiveWorkspaceId(id: string | null): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_KEY]: id });
}

/**
 * Switch to a workspace, scoped to the CURRENT window: capture the current window's
 * tabs into the active workspace, close them, and open the target's tabs in that same
 * window. Serialized via a lock and reads tabs freshly, so rapid switches and
 * mid-load switches can't corrupt or lose data. Returns the target's name.
 */
export async function switchWorkspace(targetId: string): Promise<string | null> {
  return withLock('perch-workspace-switch', async () => {
    const list = await getWorkspaces();
    const target = list.find((w) => w.id === targetId);
    if (!target) return null;
    const activeId = await getActiveWorkspaceId();
    if (activeId === targetId) return null;

    const win = await browser.windows.getCurrent();
    const winId = win?.id;
    const live = await browser.tabs.query(winId !== undefined ? { windowId: winId } : {});
    const real = live.filter((t) => t.url && !isInternalUrl(t.url));
    const captured: StashedTab[] = real.map((t) => ({
      url: t.url as string,
      title: t.title || (t.url as string),
    }));

    // Save the current window into the active workspace BEFORE closing anything.
    if (activeId) await setWorkspaceTabs(activeId, captured);

    const ids = real.map((t) => t.id).filter((id): id is number => id !== undefined);
    if (ids.length > 0) await browser.tabs.remove(ids);

    await openUrls(
      target.tabs.map((t) => t.url),
      winId,
    );
    await setActiveWorkspaceId(targetId);
    return target.name;
  });
}

export function onWorkspacesChanged(cb: () => void): () => void {
  const unsub = onSyncedChanged(WS_KEY, cb);
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && ACTIVE_KEY in changes) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => {
    unsub();
    browser.storage.onChanged.removeListener(listener);
  };
}
