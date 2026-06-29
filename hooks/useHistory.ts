/** useHistory — recent durable-history entries for ⌘K recall. */

import { useCallback, useEffect, useState } from 'react';
import { getRecentHistory, type HistoryEntry } from '../utils/history';

export interface UseHistory {
  history: HistoryEntry[];
  refresh: () => Promise<void>;
}

export function useHistory(): UseHistory {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refresh = useCallback(async () => {
    setHistory(await getRecentHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, refresh };
}
