/**
 * useDeferred — live view of the "Saved for Later" checklist, backed by
 * browser.storage.local. Subscribes to storage changes so the list stays in sync
 * across open Tab Out tabs.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  checkOffSavedTab,
  dismissSavedTab,
  getSavedTabs,
  onSavedTabsChanged,
  saveTabForLater,
} from '../utils/storage';
import type { DeferredTab } from '../utils/types';

export interface UseDeferred {
  active: DeferredTab[];
  archived: DeferredTab[];
  save: (tab: { url: string; title: string }) => Promise<void>;
  checkOff: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDeferred(): UseDeferred {
  const [active, setActive] = useState<DeferredTab[]>([]);
  const [archived, setArchived] = useState<DeferredTab[]>([]);

  const refresh = useCallback(async () => {
    const { active, archived } = await getSavedTabs();
    setActive(active);
    setArchived(archived);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onSavedTabsChanged(refresh);
    return unsub;
  }, [refresh]);

  const save = useCallback(
    async (tab: { url: string; title: string }) => {
      await saveTabForLater(tab);
      await refresh();
    },
    [refresh],
  );

  const checkOff = useCallback(
    async (id: string) => {
      await checkOffSavedTab(id);
      await refresh();
    },
    [refresh],
  );

  const dismiss = useCallback(
    async (id: string) => {
      await dismissSavedTab(id);
      await refresh();
    },
    [refresh],
  );

  return { active, archived, save, checkOff, dismiss, refresh };
}
