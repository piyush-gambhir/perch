/**
 * Routines — reusable, named sets of tabs you open on demand (a "morning routine").
 * Unlike a stash, opening a routine does NOT consume it. Synced across devices.
 */

import { browser } from 'wxt/browser';
import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import type { Routine, StashedTab } from './types';

const KEY = 'routines';

export async function getRoutines(): Promise<Routine[]> {
  return loadSynced<Routine>(KEY);
}

export async function saveRoutine(name: string, tabs: StashedTab[]): Promise<Routine | null> {
  if (tabs.length === 0) return null;
  const routine: Routine = {
    id: uid(),
    name: name.trim() || 'Routine',
    createdAt: new Date().toISOString(),
    tabs,
  };
  await mutateSynced<Routine>(KEY, (list) => [routine, ...list]);
  return routine;
}

export async function deleteRoutine(id: string): Promise<void> {
  await mutateSynced<Routine>(KEY, (list) => list.filter((r) => r.id !== id));
}

export async function renameRoutine(id: string, name: string): Promise<void> {
  await mutateSynced<Routine>(KEY, (list) =>
    list.map((r) => (r.id === id ? { ...r, name: name.trim() || r.name } : r)),
  );
}

/** Open every tab in a routine (non-destructive). */
export async function openRoutine(id: string, opts: { newWindow?: boolean } = {}): Promise<void> {
  const routines = await getRoutines();
  const routine = routines.find((r) => r.id === id);
  if (!routine || routine.tabs.length === 0) return;

  if (opts.newWindow) {
    const [first, ...rest] = routine.tabs;
    const win = await browser.windows.create({ url: first.url });
    const windowId = win?.id;
    for (const tab of rest) await browser.tabs.create({ windowId, url: tab.url, active: false });
  } else {
    for (const tab of routine.tabs) await browser.tabs.create({ url: tab.url, active: false });
  }
}

export function onRoutinesChanged(cb: () => void): () => void {
  return onSyncedChanged(KEY, cb);
}
