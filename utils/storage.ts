/**
 * "Saved for Later" persistence. Backed by the synced store so the list follows the
 * user across devices (storage.sync) with a local source-of-truth fallback. No server.
 */

import { recordHistory } from './history';
import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import type { DeferredTab, SavedTabs } from './types';

const KEY = 'deferred';

/** Save a single tab to the checklist. */
export async function saveTabForLater(tab: { url: string; title: string }): Promise<void> {
  void recordHistory([tab]);
  const item: DeferredTab = {
    id: uid(),
    url: tab.url,
    title: tab.title,
    savedAt: new Date().toISOString(),
    completed: false,
    dismissed: false,
  };
  await mutateSynced<DeferredTab>(KEY, (list) => [...list, item]);
}

/** Active (unchecked) and archived (checked) saved tabs; dismissed are hidden. */
export async function getSavedTabs(): Promise<SavedTabs> {
  const deferred = await loadSynced<DeferredTab>(KEY);
  const visible = deferred.filter((t) => !t.dismissed);
  return {
    active: visible.filter((t) => !t.completed),
    archived: visible.filter((t) => t.completed),
  };
}

/** Mark a saved tab as completed (moves it to the archive). */
export async function checkOffSavedTab(id: string): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) =>
    list.map((t) =>
      t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t,
    ),
  );
}

/** Mark a saved tab as dismissed (removed from all lists). */
export async function dismissSavedTab(id: string): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) =>
    list.map((t) => (t.id === id ? { ...t, dismissed: true } : t)),
  );
}

/** Subscribe to changes to the deferred list (local or synced). Returns unsubscribe. */
export function onSavedTabsChanged(cb: () => void): () => void {
  return onSyncedChanged(KEY, cb);
}
