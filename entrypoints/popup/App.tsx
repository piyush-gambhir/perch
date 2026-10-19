/** Toolbar popup — quick actions without opening a new tab. */

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { MoonIcon, PerchMark, StashIcon } from '../../components/icons';
import { closableTabs, saveSession, toStashedTabs } from '../../utils/sessions';
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

  // Open the extension page explicitly. This still works when Chrome has temporarily
  // disabled the global new-tab override because another extension owns it.
  const openDashboard = () =>
    run(async () => {
      await browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') });
    });

  const stashWindow = () =>
    run(async () => {
      const win = await browser.windows.getCurrent();
      const tabs = await browser.tabs.query({ windowId: win.id });
      // Same rule as the dashboard's bulk actions: pinned tabs stay, and only tabs that
      // get saved are closed. Incognito tabs never enter (synced) Perch storage.
      const stashable = closableTabs(
        tabs
          .filter((t) => t.id !== undefined && !t.incognito)
          .map((t) => ({ ...t, url: t.url ?? '' })),
      );
      const stashed = toStashedTabs(stashable.map((t) => ({ url: t.url, title: t.title ?? '' })));
      if (stashed.length > 0) {
        await saveSession('Window', stashed);
        await browser.tabs.remove(stashable.map((t) => t.id as number));
      }
    });

  const suspend = () => run(async () => void (await suspendInactiveTabs()));

  return (
    <div className="popup">
      <div className="popup-head">
        <div className="popup-brand">
          <span className="popup-mark">
            <PerchMark />
          </span>
          <div>
            <strong>Perch</strong>
            <span>Your tabs, calmly organized.</span>
          </div>
        </div>
        <span className="popup-status" title="Perch is running" />
      </div>

      <div className="popup-stat">
        <strong>{count ?? '—'}</strong>
        <span>open tab{count !== 1 ? 's' : ''}</span>
      </div>

      <button className="popup-dashboard" onClick={openDashboard} disabled={busy}>
        <span>Open Perch dashboard</span>
        <span aria-hidden="true">→</span>
      </button>

      <div className="popup-actions">
        <button className="popup-action" onClick={stashWindow} disabled={busy}>
          <span className="popup-action-icon">
            <StashIcon />
          </span>
          <span>
            <strong>Stash window</strong>
            <small>Save and close these tabs</small>
          </span>
        </button>
        <button className="popup-action" onClick={suspend} disabled={busy}>
          <span className="popup-action-icon">
            <MoonIcon />
          </span>
          <span>
            <strong>Suspend inactive</strong>
            <small>Free memory without closing</small>
          </span>
        </button>
      </div>
      {error && <div className="popup-error">{error}</div>}
      <div className="popup-foot">
        Tip: type <kbd>perch</kbd> in the address bar
      </div>
    </div>
  );
}
