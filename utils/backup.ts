/**
 * Local export / import — a no-account escape hatch. Bundles all Perch data into a
 * JSON file the user can save and restore (or move between browsers). Nothing leaves
 * the device unless the user shares the file.
 */

import { getSettings, saveSettings, type Settings } from './settings';
import { loadSynced, mutateSynced } from './syncedStore';
import type { DeferredTab, Routine, Session, StashedTab, Workspace } from './types';

const isStr = (v: unknown): v is string => typeof v === 'string';

function validTabs(v: unknown): StashedTab[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is StashedTab => !!t && typeof t === 'object' && isStr((t as StashedTab).url))
    .map((t) => ({ url: t.url, title: isStr(t.title) ? t.title : t.url }));
}

function validNamedSets<T extends { id: string; name: string; tabs: StashedTab[] }>(
  v: unknown,
): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => !!x && typeof x === 'object' && isStr((x as T).id) && isStr((x as T).name))
    .map((x) => ({ ...(x as T), name: (x as T).name, tabs: validTabs((x as T).tabs) }));
}

export interface Backup {
  app: 'perch';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  deferred: DeferredTab[];
  routines: Routine[];
  workspaces: Workspace[];
  settings: Settings;
}

export async function exportAll(): Promise<Backup> {
  const [sessions, deferred, routines, workspaces, settings] = await Promise.all([
    loadSynced<Session>('sessions'),
    loadSynced<DeferredTab>('deferred'),
    loadSynced<Routine>('routines'),
    loadSynced<Workspace>('workspaces'),
    getSettings(),
  ]);
  return {
    app: 'perch',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    deferred,
    routines,
    workspaces,
    settings,
  };
}

/** Validate + restore a backup. Each element is validated; malformed entries are
 *  dropped. Writes go through the locked store so they can't race other writers. */
export async function importAll(raw: unknown): Promise<string> {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Perch backup file.');
  const data = raw as Partial<Backup>;
  if (data.app !== 'perch') throw new Error('Not a Perch backup file.');

  const counts: string[] = [];

  if (data.sessions !== undefined) {
    const sessions = validNamedSets<Session>(data.sessions).map((s) => ({
      ...s,
      createdAt: isStr(s.createdAt) ? s.createdAt : new Date().toISOString(),
    }));
    await mutateSynced<Session>('sessions', () => sessions);
    counts.push(`${sessions.length} stashes`);
  }
  if (data.routines !== undefined) {
    const routines = validNamedSets<Routine>(data.routines).map((r) => ({
      ...r,
      createdAt: isStr(r.createdAt) ? r.createdAt : new Date().toISOString(),
    }));
    await mutateSynced<Routine>('routines', () => routines);
    counts.push(`${routines.length} routines`);
  }
  if (data.workspaces !== undefined) {
    const workspaces = validNamedSets<Workspace>(data.workspaces);
    await mutateSynced<Workspace>('workspaces', () => workspaces);
    counts.push(`${workspaces.length} workspaces`);
  }
  if (data.deferred !== undefined) {
    const deferred = (Array.isArray(data.deferred) ? data.deferred : []).filter(
      (t): t is DeferredTab =>
        !!t &&
        typeof t === 'object' &&
        isStr((t as DeferredTab).id) &&
        isStr((t as DeferredTab).url),
    );
    await mutateSynced<DeferredTab>('deferred', () => deferred);
    counts.push(`${deferred.length} saved`);
  }
  if (data.settings && typeof data.settings === 'object') {
    await saveSettings(data.settings as Partial<Settings>);
  }
  return counts.length ? `Imported ${counts.join(', ')}` : 'Nothing to import';
}

/** Trigger a download of the current backup as a .json file. */
export async function downloadBackup(): Promise<void> {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `perch-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
