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
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
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
