/**
 * Routines — reusable, named sets of tabs you open on demand (a "morning routine").
 * Unlike a stash, opening a routine does NOT consume it. Synced across devices.
 */

import { browser } from 'wxt/browser';
import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import { openStashedTabs } from './tabs';
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

export async function setRoutineSchedule(id: string, schedule?: string): Promise<void> {
  await mutateSynced<Routine>(KEY, (list) =>
    list.map((routine) => (routine.id === id ? { ...routine, schedule } : routine)),
  );
}

/** Open every tab in a routine (non-destructive). */
export async function openRoutine(id: string, opts: { newWindow?: boolean } = {}): Promise<void> {
  const routines = await getRoutines();
  const routine = routines.find((r) => r.id === id);
  if (!routine || routine.tabs.length === 0) return;

  if (opts.newWindow) {
    const win = await browser.windows.create({});
    await openStashedTabs(routine.tabs, { windowId: win?.id, skipOpen: true });
  } else {
    await openStashedTabs(routine.tabs, { skipOpen: true });
  }
}

export function onRoutinesChanged(cb: () => void): () => void {
  return onSyncedChanged(KEY, cb);
}
