/** useFirstRun — true until the user dismisses the welcome tour (stored locally). */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

const KEY = 'onboardedV1';

export function useFirstRun(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);

  useEffect(() => {
    browser.storage.local
      .get(KEY)
      .then((r) => {
        if (!(r as Record<string, unknown>)[KEY]) setShow(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setShow(false);
    browser.storage.local.set({ [KEY]: true }).catch(() => {});
  };

  return { show, dismiss };
}
