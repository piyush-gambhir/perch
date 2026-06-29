/** useWorkspaces — live workspace list + active id, with a lazily-seeded "Default". */

import { useCallback, useEffect, useState } from 'react';
import {
  createWorkspace,
  getActiveWorkspaceId,
  getWorkspaces,
  onWorkspacesChanged,
  setActiveWorkspaceId,
} from '../utils/workspaces';
import type { Workspace } from '../utils/types';

export interface UseWorkspaces {
  workspaces: Workspace[];
  activeId: string | null;
  refresh: () => Promise<void>;
}

export function useWorkspaces(): UseWorkspaces {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    let list = await getWorkspaces();
    let active = await getActiveWorkspaceId();
    // Seed a Default workspace the first time, so there's always an active context.
    if (list.length === 0) {
      const def = await createWorkspace('Default');
      list = [def];
      active = def.id;
      await setActiveWorkspaceId(def.id);
    } else if (!active || !list.some((w) => w.id === active)) {
      active = list[0].id;
      await setActiveWorkspaceId(active);
    }
    setWorkspaces(list);
    setActiveId(active);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onWorkspacesChanged(refresh);
    return unsub;
  }, [refresh]);

  return { workspaces, activeId, refresh };
}
