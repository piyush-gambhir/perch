/**
 * useSessions — live view of stashed sessions and the recently-closed undo stack,
 * backed by browser.storage.local (synced across open Perch tabs).
 */

import { useCallback, useEffect, useState } from 'react';
import { getRecentlyClosed, getSessions, onSessionsChanged } from '../utils/sessions';
import type { ClosedRecord, Session } from '../utils/types';

export interface UseSessions {
  sessions: Session[];
  recentlyClosed: ClosedRecord[];
  refresh: () => Promise<void>;
}

export function useSessions(): UseSessions {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recentlyClosed, setRecentlyClosed] = useState<ClosedRecord[]>([]);

  const refresh = useCallback(async () => {
    setSessions(await getSessions());
    setRecentlyClosed(await getRecentlyClosed());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onSessionsChanged(refresh);
    return unsub;
  }, [refresh]);

  return { sessions, recentlyClosed, refresh };
}
