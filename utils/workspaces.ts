








import { browser } from 'wxt/browser';
import { uid } from './id';
import { withLock } from './locks';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import { isInternalUrl, openStashedTabs } from './tabs';
import type { StashedTab, Workspace } from './types';

const WS_KEY = 'workspaces';
const ACTIVE_KEY = 'activeWorkspace';


const UNOPENED_KEY = 'activeWorkspaceUnopened';

export async function getWorkspaces(): Promise<Workspace[]> {
  return loadSynced<Workspace>(WS_KEY);
}

export async function createWorkspace(name: string, tabs: StashedTab[] = []): Promise<Workspace> {
  const ws: Workspace = { id: uid(), name: name.trim() || 'Workspace', tabs };
  await mutateSynced<Workspace>(WS_KEY, (list) => [...list, ws]);
  return ws;
}



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


    const real = live.filter((t) => t.url && !isInternalUrl(t.url) && !t.incognito && !t.pinned);
    const inWindow: StashedTab[] = real.map((t) => ({
      url: t.url as string,
      title: t.title || (t.url as string),
    }));

    const { [UNOPENED_KEY]: unopened } = (await browser.storage.local.get(UNOPENED_KEY)) as {
      [UNOPENED_KEY]?: { id: string; tabs: StashedTab[] };
    };
    const inWindowUrls = new Set(inWindow.map((t) => t.url));
    const captured = [
      ...inWindow,
      ...(unopened?.id === activeId ? unopened.tabs.filter((t) => !inWindowUrls.has(t.url)) : []),
    ];







    if (activeId || captured.length > 0) {
      await mutateSynced<Workspace>(WS_KEY, (cur) => {
        if (activeId && cur.some((w) => w.id === activeId)) {
          return cur.map((w) => (w.id === activeId ? { ...w, tabs: captured } : w));
        }
        if (captured.length === 0) return cur;
        const recovered: Workspace = {
          id: uid(),
          name: `Recovered · ${new Date().toLocaleDateString()}`,
          tabs: captured,
        };
        return [...cur, recovered];
      });
    }

    const ids = real.map((t) => t.id).filter((id): id is number => id !== undefined);
    if (ids.length > 0) await browser.tabs.remove(ids);

    const { failed } = await openStashedTabs(target.tabs, { windowId: winId });
    await browser.storage.local.set({ [UNOPENED_KEY]: { id: targetId, tabs: failed } });
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
