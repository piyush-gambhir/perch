/** useRoutines — live view of saved routines (storage.sync). */

import { useCallback, useEffect, useState } from 'react';
import { getRoutines, onRoutinesChanged } from '../utils/routines';
import type { Routine } from '../utils/types';

export interface UseRoutines {
  routines: Routine[];
  refresh: () => Promise<void>;
}

export function useRoutines(): UseRoutines {
  const [routines, setRoutines] = useState<Routine[]>([]);

  const refresh = useCallback(async () => {
    setRoutines(await getRoutines());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onRoutinesChanged(refresh);
    return unsub;
  }, [refresh]);

  return { routines, refresh };
}
