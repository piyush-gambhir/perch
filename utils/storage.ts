/**
 * "Saved for Later" persistence. Backed by the synced store so the list follows the
 * user across devices (storage.sync) with a local source-of-truth fallback. No server.
 */

import { recordHistory } from './history';
import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import type { DeferredTab, SavedTabs } from './types';

const KEY = 'deferred';
const ARCHIVED_LIMIT = 200;

function pruneArchived(list: DeferredTab[]): DeferredTab[] {
  const archived = list.filter((t) => t.completed);
  if (archived.length <= ARCHIVED_LIMIT) return list;

  const keep = new Set(
    [...archived]
      .sort((a, b) => {
        const aTime = Date.parse(a.completedAt ?? '');
        const bTime = Date.parse(b.completedAt ?? '');
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      })
      .slice(0, ARCHIVED_LIMIT)
      .map((t) => t.id),
  );
  return list.filter((t) => !t.completed || keep.has(t.id));
}

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
    pruneArchived(
      list.map((t) =>
        t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t,
      ),
    ),
  );
}

/** Mark a saved tab as dismissed (removed from all lists). */
export async function dismissSavedTab(id: string): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) => pruneArchived(list.filter((t) => t.id !== id)));
}

export async function updateSavedTabMeta(
  id: string,
  patch: Pick<DeferredTab, 'tags' | 'note'>,
): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) =>
    list.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  );
}

/** Subscribe to changes to the deferred list (local or synced). Returns unsubscribe. */
export function onSavedTabsChanged(cb: () => void): () => void {
  return onSyncedChanged(KEY, cb);
}
