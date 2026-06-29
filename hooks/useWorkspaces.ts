/** useWorkspaces — live workspace list + active id, with an atomic one-time Default seed. */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getActiveWorkspaceId,
  getWorkspaces,
  onWorkspacesChanged,
  seedDefaultIfEmpty,
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
  const seeded = useRef(false);

  // Read-only: safe to use as the change subscriber (never writes storage).
  const refresh = useCallback(async () => {
    const [list, active] = await Promise.all([getWorkspaces(), getActiveWorkspaceId()]);
    setWorkspaces(list);
    setActiveId(active && list.some((w) => w.id === active) ? active : (list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      if (!seeded.current) {
        seeded.current = true;
        const { list, seededId } = await seedDefaultIfEmpty();
        const active = await getActiveWorkspaceId();
        if (!active || !list.some((w) => w.id === active)) {
          await setActiveWorkspaceId(seededId ?? list[0]?.id ?? null);
        }
      }
      await refresh();
    })();
    const unsub = onWorkspacesChanged(refresh);
    return unsub;
  }, [refresh]);

  return { workspaces, activeId, refresh };
}
