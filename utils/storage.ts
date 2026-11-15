




import { recordHistory } from './history';
import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import type { DeferredTab, SavedTabs } from './types';

const KEY = 'deferred';


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


export async function getSavedTabs(): Promise<SavedTabs> {
  const deferred = await loadSynced<DeferredTab>(KEY);
  const visible = deferred.filter((t) => !t.dismissed);
  return {
    active: visible.filter((t) => !t.completed),
    archived: visible.filter((t) => t.completed),
  };
}


export async function checkOffSavedTab(id: string): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) =>
    list.map((t) =>
      t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t,
    ),
  );
}


export async function dismissSavedTab(id: string): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) => list.filter((t) => t.id !== id));
}

export async function updateSavedTabMeta(
  id: string,
  patch: Pick<DeferredTab, 'tags' | 'note'>,
): Promise<void> {
  await mutateSynced<DeferredTab>(KEY, (list) =>
    list.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  );
}


export function onSavedTabsChanged(cb: () => void): () => void {
  return onSyncedChanged(KEY, cb);
}
