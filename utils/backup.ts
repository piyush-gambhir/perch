/**
 * Local export / import — a no-account escape hatch. Bundles all Perch data into a
 * JSON file the user can save and restore (or move between browsers). Nothing leaves
 * the device unless the user shares the file.
 */

import { getSettings, saveSettings, type Settings } from './settings';
import { loadSynced, saveSynced } from './syncedStore';
import type { DeferredTab, Routine, Session, Workspace } from './types';

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

/** Validate + restore a backup. Returns a short summary of what was imported. */
export async function importAll(raw: unknown): Promise<string> {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Perch backup file.');
  const data = raw as Partial<Backup>;
  if (data.app !== 'perch') throw new Error('Not a Perch backup file.');

  const counts: string[] = [];
  if (Array.isArray(data.sessions)) {
    await saveSynced('sessions', data.sessions);
    counts.push(`${data.sessions.length} stashes`);
  }
  if (Array.isArray(data.deferred)) {
    await saveSynced('deferred', data.deferred);
    counts.push(`${data.deferred.length} saved`);
  }
  if (Array.isArray(data.routines)) {
    await saveSynced('routines', data.routines);
    counts.push(`${data.routines.length} routines`);
  }
  if (Array.isArray(data.workspaces)) {
    await saveSynced('workspaces', data.workspaces);
    counts.push(`${data.workspaces.length} workspaces`);
  }
  if (data.settings && typeof data.settings === 'object') {
    await saveSettings(data.settings);
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
