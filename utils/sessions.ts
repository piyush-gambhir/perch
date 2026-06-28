/**
 * Sessions ("stashes") and recently-closed undo, persisted in
 * browser.storage.local. A session is a named, restorable set of tabs; the undo
 * stack remembers the last few closes so they can be reopened. This is what makes
 * closing tabs *safe* — nothing is lost for good.
 */

import { browser } from 'wxt/browser';
import { reorderById } from './dnd';
import { loadSynced, onSyncedChanged, saveSynced } from './syncedStore';
import { isInternalUrl } from './tabs';
import type { ClosedRecord, Session, StashedTab } from './types';

const SESSIONS_KEY = 'sessions';
const CLOSED_KEY = 'recentlyClosed';
const CLOSED_LIMIT = 12;

let counter = 0;
function uid(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

/** Reduce live tabs to the minimal {url,title} we persist, skipping internals. */
export function toStashedTabs(tabs: { url: string; title: string }[]): StashedTab[] {
  return tabs
    .filter((t) => t.url && !isInternalUrl(t.url))
    .map((t) => ({ url: t.url, title: t.title || t.url }));
}

/* ---- Sessions ---- */

export async function getSessions(): Promise<Session[]> {
  // Preserve stored order (newest is prepended on save; manual reorder persists).
  return loadSynced<Session>(SESSIONS_KEY);
}

export async function saveSession(name: string, tabs: StashedTab[]): Promise<Session | null> {
  if (tabs.length === 0) return null;
  const sessions = await getSessions();
  const session: Session = {
    id: uid(),
    name: name.trim() || 'Untitled stash',
    createdAt: new Date().toISOString(),
    tabs,
  };
  await saveSynced(SESSIONS_KEY, [session, ...sessions]);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  await saveSynced(
    SESSIONS_KEY,
    sessions.filter((s) => s.id !== id),
  );
}

export async function renameSession(id: string, name: string): Promise<void> {
  const sessions = await getSessions();
  const s = sessions.find((x) => x.id === id);
  if (s) {
    s.name = name.trim() || s.name;
    await saveSynced(SESSIONS_KEY, sessions);
  }
}

/** Append tabs to an existing session (used by drag-and-drop), de-duplicating by URL. */
export async function addTabsToSession(id: string, tabs: StashedTab[]): Promise<void> {
  const sessions = await getSessions();
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  const seen = new Set(s.tabs.map((t) => t.url));
  for (const t of tabs) {
    if (!seen.has(t.url)) {
      s.tabs.push(t);
      seen.add(t.url);
    }
  }
  await saveSynced(SESSIONS_KEY, sessions);
}

/** Open every tab in a session. Optionally in a new window, and/or remove after. */
export async function restoreSession(
  id: string,
  opts: { remove?: boolean; newWindow?: boolean } = {},
): Promise<void> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session || session.tabs.length === 0) return;

  if (opts.newWindow) {
    const [first, ...rest] = session.tabs;
    const win = await browser.windows.create({ url: first.url });
    const windowId = win?.id;
    for (const tab of rest) {
      await browser.tabs.create({ windowId, url: tab.url, active: false });
    }
  } else {
    for (const tab of session.tabs) {
      await browser.tabs.create({ url: tab.url, active: false });
    }
  }
  if (opts.remove) await deleteSession(id);
}

/** Reorder stashes by moving one before another (drag-to-reorder). */
export async function reorderSessions(draggedId: string, targetId: string): Promise<void> {
  const sessions = await getSessions();
  const next = reorderById(sessions, draggedId, targetId, (s) => s.id);
  if (next !== sessions) await saveSynced(SESSIONS_KEY, next);
}

/* ---- Recently closed (undo) ---- */

export async function getRecentlyClosed(): Promise<ClosedRecord[]> {
  const { recentlyClosed = [] } = (await browser.storage.local.get(CLOSED_KEY)) as {
    recentlyClosed?: ClosedRecord[];
  };
  return recentlyClosed;
}

/** Record a close so it can be undone. Newest first, capped. */
export async function pushClosed(label: string, tabs: StashedTab[]): Promise<void> {
  if (tabs.length === 0) return;
  const existing = await getRecentlyClosed();
  const record: ClosedRecord = { id: uid(), closedAt: new Date().toISOString(), label, tabs };
  await browser.storage.local.set({ [CLOSED_KEY]: [record, ...existing].slice(0, CLOSED_LIMIT) });
}

/** Reopen a closed record's tabs and remove it from the undo stack. */
export async function restoreClosed(id: string): Promise<void> {
  const existing = await getRecentlyClosed();
  const record = existing.find((r) => r.id === id);
  if (!record) return;
  for (const tab of record.tabs) {
    await browser.tabs.create({ url: tab.url, active: false });
  }
  await browser.storage.local.set({ [CLOSED_KEY]: existing.filter((r) => r.id !== id) });
}

/** Reopen the most recent close (the Undo button / Cmd+Shift+T equivalent). */
export async function undoLastClose(): Promise<boolean> {
  const existing = await getRecentlyClosed();
  if (existing.length === 0) return false;
  await restoreClosed(existing[0].id);
  return true;
}

export async function clearRecentlyClosed(): Promise<void> {
  await browser.storage.local.set({ [CLOSED_KEY]: [] });
}

/** Subscribe to changes in either sessions (synced) or the undo stack (local). */
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
