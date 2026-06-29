/** Toolbar popup — quick actions without opening a new tab. */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { saveSession, toStashedTabs } from '../../utils/sessions';
import { fetchOpenTabs, isInternalUrl, suspendInactiveTabs } from '../../utils/tabs';

export function Popup() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOpenTabs()
      .then((tabs) => setCount(tabs.filter((t) => !isInternalUrl(t.url)).length))
      .catch(() => setCount(null));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      window.close();
    } catch {
      setError('Something went wrong. Try again.');
      setBusy(false);
    }
  };

  const openDashboard = () => run(async () => void (await browser.tabs.create({})));

  const stashWindow = () =>
    run(async () => {
      const win = await browser.windows.getCurrent();
      const tabs = await browser.tabs.query({ windowId: win.id });
      const stashable = tabs.filter((t) => t.url && !isInternalUrl(t.url) && t.id !== undefined);
      const stashed = toStashedTabs(
        stashable.map((t) => ({ url: t.url ?? '', title: t.title ?? '' })),
      );
      if (stashed.length > 0) {
        await saveSession('Window', stashed);
        await browser.tabs.remove(stashable.map((t) => t.id as number));
      }
    });

  const suspend = () => run(async () => void (await suspendInactiveTabs()));

  return (
    <div className="popup">
      <div className="popup-head">
        <span className="popup-brand">Perch</span>
        {count !== null && (
          <span className="popup-count">
            {count} open tab{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <button className="popup-btn primary" onClick={openDashboard} disabled={busy}>
        Open dashboard
      </button>
      <button className="popup-btn" onClick={stashWindow} disabled={busy}>
        Stash this window
      </button>
      <button className="popup-btn" onClick={suspend} disabled={busy}>
        Suspend inactive tabs
      </button>
      {error && <div className="popup-error">{error}</div>}
    </div>
  );
}
