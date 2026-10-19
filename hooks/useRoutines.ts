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
    const initial = setTimeout(refresh, 0);
    const unsub = onRoutinesChanged(refresh);
    return () => {
      clearTimeout(initial);
      unsub();
    };
  }, [refresh]);

  return { routines, refresh };
}
