






import { browser } from 'wxt/browser';
import { reorderById } from './dnd';
import { recordHistory } from './history';
import { uid } from './id';
import { withLock } from './locks';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import { isInternalUrl, openStashedTabs } from './tabs';
import type { ClosedRecord, Session, StashedTab } from './types';

const SESSIONS_KEY = 'sessions';
const CLOSED_KEY = 'recentlyClosed';
const CLOSED_LIMIT = 12;


const isSavable = (t: { url: string }) => !!t.url && !isInternalUrl(t.url);


export function toStashedTabs(
  tabs: { url: string; title: string; pinned?: boolean }[],
): StashedTab[] {
  return tabs
    .filter(isSavable)
    .map((t) => ({ url: t.url, title: t.title || t.url, pinned: t.pinned || undefined }));
}





export function closableTabs<T extends { url: string; pinned?: boolean }>(tabs: T[]): T[] {
  return tabs.filter((t) => !t.pinned && isSavable(t));
}



export async function getSessions(): Promise<Session[]> {

  return loadSynced<Session>(SESSIONS_KEY);
}

export async function saveSession(name: string, tabs: StashedTab[]): Promise<Session | null> {
  if (tabs.length === 0) return null;
  void recordHistory(tabs);
  const session: Session = {
    id: uid(),
    name: name.trim() || 'Untitled stash',
    createdAt: new Date().toISOString(),
    tabs,
  };
  await mutateSynced<Session>(SESSIONS_KEY, (list) => [session, ...list]);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await mutateSynced<Session>(SESSIONS_KEY, (list) => list.filter((s) => s.id !== id));
}

export async function renameSession(id: string, name: string): Promise<void> {
  await mutateSynced<Session>(SESSIONS_KEY, (list) =>
    list.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)),
  );
}

export async function updateSessionMeta(
  id: string,
  patch: Pick<Session, 'tags' | 'note'>,
): Promise<void> {
  await mutateSynced<Session>(SESSIONS_KEY, (list) =>
    list.map((session) => (session.id === id ? { ...session, ...patch } : session)),
  );
}


export async function addTabsToSession(id: string, tabs: StashedTab[]): Promise<void> {
  void recordHistory(tabs);
  await mutateSynced<Session>(SESSIONS_KEY, (list) =>
    list.map((s) => {
      if (s.id !== id) return s;
      const seen = new Set(s.tabs.map((t) => t.url));
      const added = tabs.filter((t) => !seen.has(t.url));
      return added.length ? { ...s, tabs: [...s.tabs, ...added] } : s;
    }),
  );
}





export async function appendOrCreateSession(name: string, tabs: StashedTab[]): Promise<void> {
  if (tabs.length === 0) return;
  void recordHistory(tabs);
  await mutateSynced<Session>(SESSIONS_KEY, (list) => {

    const existing = list.find((s) => s.auto && s.name === name);
    if (existing) {
      const seen = new Set(existing.tabs.map((t) => t.url));
      const added = tabs.filter((t) => !seen.has(t.url));
      if (!added.length) return list;
      return list.map((s) => (s.id === existing.id ? { ...s, tabs: [...s.tabs, ...added] } : s));
    }
    const session: Session = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      tabs,
      auto: true,
    };
    return [session, ...list];
  });
}






export async function restoreSession(
  id: string,
  opts: { remove?: boolean; newWindow?: boolean } = {},
): Promise<{ opened: number; failed: number }> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session || session.tabs.length === 0) return { opened: 0, failed: 0 };



  const restored = session.tabs;

  let result: Awaited<ReturnType<typeof openStashedTabs>>;
  if (opts.newWindow) {


    const [first, ...rest] = restored;
    if (!first) return { opened: 0, failed: 0 };
    let win: { id?: number } | undefined;
    let remaining = rest;
    let openedFirst = 0;
    try {
      win = await browser.windows.create({ url: first.url });
      openedFirst = 1;
    } catch {
      win = await browser.windows.create({});
      remaining = restored;
    }
    result = await openStashedTabs(remaining, { windowId: win?.id, skipOpen: true });
    result.opened += openedFirst;
  } else {
    result = await openStashedTabs(restored, { skipOpen: true });
  }

  if (opts.remove) {
    const failedUrls = new Set(result.failed.map((t) => t.url));
    const restoredUrls = new Set(restored.map((t) => t.url).filter((url) => !failedUrls.has(url)));
    await mutateSynced<Session>(SESSIONS_KEY, (list) =>
      list
        .map((s) =>
          s.id === id ? { ...s, tabs: s.tabs.filter((t) => !restoredUrls.has(t.url)) } : s,
        )
        .filter((s) => s.id !== id || s.tabs.length > 0),
    );
  }
  return { opened: result.opened, failed: result.failed.length };
}


export async function reorderSessions(draggedId: string, targetId: string): Promise<void> {
  await mutateSynced<Session>(SESSIONS_KEY, (list) =>
    reorderById(list, draggedId, targetId, (s) => s.id),
  );
}



export async function getRecentlyClosed(): Promise<ClosedRecord[]> {
  const { recentlyClosed = [] } = (await browser.storage.local.get(CLOSED_KEY)) as {
    recentlyClosed?: ClosedRecord[];
  };
  return recentlyClosed;
}


export async function pushClosed(label: string, tabs: StashedTab[]): Promise<void> {
  if (tabs.length === 0) return;
  void recordHistory(tabs);
  const record: ClosedRecord = { id: uid(), closedAt: new Date().toISOString(), label, tabs };
  await withLock(`perch-store:${CLOSED_KEY}`, async () => {
    const existing = await getRecentlyClosed();
    await browser.storage.local.set({ [CLOSED_KEY]: [record, ...existing].slice(0, CLOSED_LIMIT) });
  });
}







export async function restoreClosed(
  id: string,
): Promise<{ opened: number; failed: number } | null> {
  return withLock(`perch-store:${CLOSED_KEY}`, async () => {
    const cur = await getRecentlyClosed();
    const record = cur.find((r) => r.id === id);
    if (!record) return null;
    const { opened, failed } = await openStashedTabs(record.tabs);
    await browser.storage.local.set({
      [CLOSED_KEY]: cur
        .map((r) => (r.id === id ? { ...r, tabs: failed } : r))
        .filter((r) => r.id !== id || r.tabs.length > 0),
    });
    return { opened, failed: failed.length };
  });
}


export async function undoLastClose(): Promise<{ opened: number; failed: number } | null> {
  const existing = await getRecentlyClosed();
  if (existing.length === 0) return null;
  const latest = existing[0];
  if (!latest) return null;
  return restoreClosed(latest.id);
}


export function onSessionsChanged(cb: () => void): () => void {
  const unsubSessions = onSyncedChanged(SESSIONS_KEY, cb);
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && CLOSED_KEY in changes) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => {
    unsubSessions();
    browser.storage.onChanged.removeListener(listener);
  };
}
