/** Perch dashboard — the new-tab page. Composes hooks + components. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette, type PaletteItem } from '../../components/CommandPalette';
import { ControlCenter } from '../../components/ControlCenter';
import { DomainCard } from '../../components/DomainCard';
import { DupeBanner } from '../../components/DupeBanner';
import { FirstRunTour } from '../../components/FirstRunTour';
import {
  CheckIcon,
  CloseIcon,
  GearIcon,
  MoonIcon,
  PerchMark,
  SearchIcon,
  StashIcon,
  UndoIcon,
} from '../../components/icons';
import { Routines } from '../../components/Routines';
import { SavedForLater } from '../../components/SavedForLater';
import { Sessions } from '../../components/Sessions';
import { SettingsModal } from '../../components/SettingsModal';
import { StaleBanner } from '../../components/StaleBanner';
import { ToastProvider, useToast } from '../../components/Toast';
import { WorkspaceBar } from '../../components/WorkspaceBar';
import { useDeferred } from '../../hooks/useDeferred';
import { useHistory } from '../../hooks/useHistory';
import { useRoutines } from '../../hooks/useRoutines';
import { useSessions } from '../../hooks/useSessions';
import { useSettings } from '../../hooks/useSettings';
import { useFirstRun } from '../../hooks/useFirstRun';
import { useTabs } from '../../hooks/useTabs';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../../utils/workspaces';
import {
  deleteRoutine,
  openRoutine,
  renameRoutine,
  saveRoutine,
  setRoutineSchedule,
} from '../../utils/routines';
import {
  displayTitle,
  friendlyDomain,
  getDateDisplay,
  getGreeting,
  hostOf,
} from '../../utils/format';
import type { DragTab } from '../../utils/dnd';
import {
  addTabsToSession,
  closableTabs,
  deleteSession,
  pushClosed,
  renameSession,
  reorderSessions,
  restoreSession,
  saveSession,
  toStashedTabs,
  undoLastClose,
  updateSessionMeta,
} from '../../utils/sessions';
import { staleTabs } from '../../utils/stale';
import {
  APPROX_MB_PER_TAB,
  closeDuplicateTabs,
  closeTabByUrl,
  closeTabOutDupes,
  closeTabsByIds,
  discardableCount,
  focusTab,
  groupTabsInBrowser,
  openUrl,
  suspendInactiveTabs,
  suspendTabsExcept,
  ungroupTabsInBrowser,
} from '../../utils/tabs';
import type { DomainGroup, TabInfo } from '../../utils/types';
import { LANDING_PAGES_KEY } from '../../utils/types';
import { captureSnapshot } from '../../utils/snapshots';

function EmptyState() {
  return (
    <div className="missions-empty-state">
      <div className="empty-checkmark">
        <CheckIcon />
      </div>
      <div className="empty-title">Inbox zero, but for tabs.</div>
      <div className="empty-subtitle">You&apos;re free.</div>
    </div>
  );
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const SEARCH_HINT = IS_MAC ? '⌘K' : 'Ctrl K';

/** When this new-tab page was opened — a stable "now" for pure-render staleness math. */
const PAGE_OPENED_AT = Date.now();

const STALE_SNOOZE_KEY = 'staleSnoozedUntil';
const DUPE_SNOOZE_KEY = 'dupeSnoozedUntil';

/** Epoch ms for the end of today — a dismissed banner stays hidden until then. */
function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function formatFreed(n: number): string {
  const mb = n * APPROX_MB_PER_TAB;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

/** Toast for a restore where some tabs could not open (their records are kept). */
function failedToOpen(failed: number): string {
  return `Couldn't open ${failed} tab${failed !== 1 ? 's' : ''}. Kept for another try.`;
}

function Dashboard() {
  const { realTabs, groups, tabOutCount, refresh } = useTabs();
  const deferred = useDeferred();
  const { sessions, recentlyClosed } = useSessions();
  const { history, refresh: refreshHistory } = useHistory();
  const { routines } = useRoutines();
  const { workspaces, activeId: activeWorkspaceId } = useWorkspaces();
  const { settings, update: updateSettings } = useSettings();
  const firstRun = useFirstRun();
  const showToast = useToast();

  const [paletteOpen, setPaletteOpen] = useState(
    () => !!new URLSearchParams(location.search).get('q'),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [dupeDismissed, setDupeDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const switchingRef = useRef(false);

  // Dismissing a banner snoozes it until end of day, persisted so a fresh new-tab
  // page doesn't resurrect a banner the user already waved off today.
  useEffect(() => {
    browser.storage.local
      .get([STALE_SNOOZE_KEY, DUPE_SNOOZE_KEY])
      .then((res) => {
        const now = Date.now();
        if (typeof res[STALE_SNOOZE_KEY] === 'number' && res[STALE_SNOOZE_KEY] > now)
          setStaleDismissed(true);
        if (typeof res[DUPE_SNOOZE_KEY] === 'number' && res[DUPE_SNOOZE_KEY] > now)
          setDupeDismissed(true);
      })
      .catch(() => {});
  }, []);

  const snoozeStale = () => {
    setStaleDismissed(true);
    browser.storage.local.set({ [STALE_SNOOZE_KEY]: endOfToday() }).catch(() => {});
  };

  const snoozeDupe = () => {
    setDupeDismissed(true);
    browser.storage.local.set({ [DUPE_SNOOZE_KEY]: endOfToday() }).catch(() => {});
  };

  const greeting = useMemo(() => getGreeting(), []);
  const dateDisplay = useMemo(() => getDateDisplay(), []);
  const stale = useMemo(
    // PAGE_OPENED_AT keeps render pure; against a multi-day staleness threshold,
    // being minutes out of date is invisible, and tab events refresh realTabs anyway.
    () => staleTabs(realTabs, PAGE_OPENED_AT, settings.staleDays),
    [realTabs, settings.staleDays],
  );
  const canSuspend = useMemo(() => discardableCount(realTabs), [realTabs]);
  const duplicateExtras = useMemo(() => {
    const counts = new Map<string, number>();
    realTabs.forEach((tab) => counts.set(tab.url, (counts.get(tab.url) ?? 0) + 1));
    return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  }, [realTabs]);
  const largestGroup = groups[0];

  const openPalette = () => {
    void refreshHistory();
    setPaletteOpen(true);
  };

  // Keyboard: Cmd/Ctrl+K or "/" opens the command palette. Suppressed while the
  // welcome tour or settings modal is up — it would open underneath them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (firstRun.show || settingsOpen || controlOpen) return;
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => {
          if (!o) void refreshHistory();
          return !o;
        });
      } else if (e.key === '/' && !typing && !paletteOpen) {
        e.preventDefault();
        void refreshHistory();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, refreshHistory, firstRun.show, settingsOpen, controlOpen]);

  const groupLabel = (g: DomainGroup) =>
    g.domain === LANDING_PAGES_KEY ? 'Homepages' : g.label || friendlyDomain(g.domain);

  const idsOf = (tabs: TabInfo[]) => tabs.map((t) => t.id);

  const handleFocus = (url: string) => focusTab(url);

  const handleSaveTab = async (tab: { url: string; title: string }) => {
    await deferred.save(tab);
    await closeTabByUrl(tab.url);
    showToast('Saved for later');
    await refresh();
  };

  const handleCloseTab = async (url: string) => {
    const closed = await closeTabByUrl(url);
    await pushClosed(closed[0]?.title || 'Tab', closed);
    showToast('Tab closed');
    await refresh();
  };

  const handleCloseGroup = async (group: DomainGroup) => {
    // Pinned tabs stay open, as in Close all.
    const closable = closableTabs(group.tabs);
    if (closable.length === 0) return;
    // Record the undo entry BEFORE closing: if closing fails halfway, the tabs that
    // did close are still recoverable (mirrors the stash-then-close ordering).
    const stashed = toStashedTabs(closable);
    await pushClosed(groupLabel(group), stashed);
    await closeTabsByIds(idsOf(closable));
    showToast(`Closed ${closable.length} tab${closable.length !== 1 ? 's' : ''}`, () =>
      handleUndo(),
    );
    await refresh();
  };

  const handleStashGroup = async (group: DomainGroup) => {
    const closable = closableTabs(group.tabs);
    const tabs = toStashedTabs(closable);
    if (tabs.length === 0) return;
    await saveSession(groupLabel(group), tabs);
    await closeTabsByIds(idsOf(closable));
    showToast(`Stashed ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleDedup = async (urls: string[]) => {
    if (urls.length === 0) return;
    await closeDuplicateTabs(urls, true);
    showToast('Closed duplicates, kept one copy each');
    await refresh();
  };

  const handleCloseAll = async () => {
    // Pinned tabs are deliberately kept: "fresh start" shouldn't take them down.
    const closable = closableTabs(realTabs);
    const stashed = toStashedTabs(closable);
    await pushClosed(`${stashed.length} tabs`, stashed);
    await closeTabsByIds(idsOf(closable));
    showToast('All tabs closed. Fresh start.', () => handleUndo());
    await refresh();
  };

  const handleStashAll = async () => {
    const closable = closableTabs(realTabs);
    const tabs = toStashedTabs(closable);
    if (tabs.length === 0) return;
    await saveSession('All tabs', tabs);
    await closeTabsByIds(idsOf(closable));
    showToast(`Stashed ${tabs.length} tabs`);
    await refresh();
  };

  const handleSuspend = async () => {
    const n = await suspendInactiveTabs();
    showToast(
      n > 0
        ? `Suspended ${n} tab${n !== 1 ? 's' : ''} · ~${formatFreed(n)} freed`
        : 'Nothing to suspend',
    );
    await refresh();
  };

  const handleUndo = async () => {
    const result = await undoLastClose();
    showToast(
      !result ? 'Nothing to undo' : result.failed ? failedToOpen(result.failed) : 'Reopened',
    );
    await refresh();
  };

  const handleRestoreSession = async (id: string) => {
    const session = sessions.find((item) => item.id === id);
    if (session) {
      const domains = [...new Set(session.tabs.map((tab) => hostOf(tab.url)).filter(Boolean))];
      if (
        !window.confirm(
          `Restore ${session.tabs.length} tabs from ${session.name}?\n\n${domains.slice(0, 6).join(', ')}${domains.length > 6 ? '…' : ''}\n\nTabs already open will be skipped.`,
        )
      )
        return;
    }
    const { failed } = await restoreSession(id, { remove: true });
    showToast(failed ? failedToOpen(failed) : 'Stash restored');
    await refresh();
  };

  const handleRestoreNewWindow = async (id: string) => {
    const { failed } = await restoreSession(id, { remove: true, newWindow: true });
    showToast(failed ? failedToOpen(failed) : 'Opened in a new window');
    await refresh();
  };

  const handleRenameSession = async (id: string, name: string) => {
    await renameSession(id, name);
  };

  const handleReorderSession = async (draggedId: string, targetId: string) => {
    await reorderSessions(draggedId, targetId);
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    showToast('Stash deleted');
  };

  const handleCreateRoutine = async () => {
    const tabs = toStashedTabs(realTabs);
    if (tabs.length === 0) {
      showToast('No tabs to save');
      return;
    }
    await saveRoutine('Routine', tabs);
    showToast('Routine saved — click its name to rename');
  };

  const handleOpenRoutine = async (id: string) => {
    await openRoutine(id);
    showToast('Opening routine');
    await refresh();
  };

  const handleOpenRoutineNewWindow = async (id: string) => {
    await openRoutine(id, { newWindow: true });
    showToast('Opening routine in a new window');
    await refresh();
  };

  const handleRenameRoutine = async (id: string, name: string) => {
    await renameRoutine(id, name);
  };

  const handleDeleteRoutine = async (id: string) => {
    await deleteRoutine(id);
    showToast('Routine deleted');
  };

  const handleSwitchWorkspace = async (targetId: string) => {
    if (switchingRef.current || targetId === activeWorkspaceId) return;
    const target = workspaces.find((workspace) => workspace.id === targetId);
    if (
      target &&
      !window.confirm(
        `Switch to ${target.name}?\n\n${target.tabs.length} saved tabs will open. Your current window will be captured first, and a recovery snapshot will be kept.`,
      )
    )
      return;
    switchingRef.current = true;
    try {
      await captureSnapshot('before-switch', true);
      const name = await switchWorkspace(targetId);
      if (name) {
        showToast(`Switched to ${name}`);
        await refresh();
      }
    } finally {
      switchingRef.current = false;
    }
  };

  const handleCreateWorkspace = async () => {
    const ws = await createWorkspace('Workspace');
    showToast(`Created ${ws.name} — double-click to rename`);
  };

  const handleRenameWorkspace = async (id: string, name: string) => {
    await renameWorkspace(id, name);
  };

  const handleDeleteWorkspace = async (id: string) => {
    await deleteWorkspace(id);
    showToast('Workspace deleted');
  };

  const handleStashStale = async (tabs: TabInfo[]) => {
    const stashed = toStashedTabs(tabs);
    if (stashed.length === 0) return;
    await saveSession('Stale tabs', stashed);
    await closeTabsByIds(idsOf(tabs));
    setStaleDismissed(true);
    showToast(`Stashed ${stashed.length} stale tab${stashed.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleCloseStale = async (tabs: TabInfo[]) => {
    const stashed = toStashedTabs(tabs);
    await pushClosed('Stale tabs', stashed);
    await closeTabsByIds(idsOf(tabs));
    setStaleDismissed(true);
    showToast(`Closed ${stashed.length} stale tab${stashed.length !== 1 ? 's' : ''}`, () =>
      handleUndo(),
    );
    await refresh();
  };

  const handleTabOutDupes = async () => {
    await closeTabOutDupes();
    showToast('Closed extra Perch tabs');
    await refresh();
  };

  const handleFocusGroup = async (group: DomainGroup) => {
    const n = await suspendTabsExcept(idsOf(group.tabs));
    showToast(
      n > 0 ? `Focused — suspended ${n} other tab${n !== 1 ? 's' : ''}` : 'Nothing else to suspend',
    );
    await refresh();
  };

  const handleGroupInBrowser = async (group: DomainGroup) => {
    await groupTabsInBrowser(group.tabs, groupLabel(group));
    showToast('Grouped in browser');
    await refresh();
  };

  const handleUngroup = async (group: DomainGroup) => {
    if (group.groupId !== undefined && group.groupId >= 0)
      await ungroupTabsInBrowser(group.groupId);
    showToast('Ungrouped');
    await refresh();
  };

  const handleDropToSession = async (id: string, tab: DragTab) => {
    await addTabsToSession(id, [tab]);
    await closeTabByUrl(tab.url);
    showToast('Added to stash');
    await refresh();
  };

  const handleCreateStashFromDrop = async (tab: DragTab) => {
    await saveSession(tab.title || hostOf(tab.url) || 'Stash', [tab]);
    await closeTabByUrl(tab.url);
    showToast('Stashed');
    await refresh();
  };

  const handleDropSave = async (tab: DragTab) => {
    await deferred.save(tab);
    await closeTabByUrl(tab.url);
    showToast('Saved for later');
    await refresh();
  };

  const paletteItems: PaletteItem[] = useMemo(() => {
    const tabItems: PaletteItem[] = realTabs
      .filter((t) => !t.isPerchTab)
      .map((t) => {
        const hostname = hostOf(t.url);
        return {
          id: `tab-${t.id ?? t.url}`,
          title: displayTitle(t.title || '', t.url, hostname) || t.url,
          subtitle: hostname || t.url,
          kind: 'tab',
          hostname,
          favIconUrl: t.favIconUrl,
          timestamp: t.lastAccessed,
          run: () => focusTab(t.url),
        };
      });
    const savedItems: PaletteItem[] = deferred.active.map((d) => {
      const hostname = hostOf(d.url);
      return {
        id: `saved-${d.id}`,
        title: d.title || d.url,
        subtitle: hostname,
        searchText: [...(d.tags ?? []), d.note ?? ''].join(' '),
        timestamp: Date.parse(d.savedAt),
        kind: 'saved',
        hostname,
        run: () => openUrl(d.url),
      };
    });
    const sessionItems: PaletteItem[] = sessions.map((s) => ({
      id: `sess-${s.id}`,
      title: s.name,
      subtitle: `${s.tabs.length} tab${s.tabs.length !== 1 ? 's' : ''}`,
      kind: 'session',
      searchText: [...(s.tags ?? []), s.note ?? '', ...s.tabs.map((tab) => tab.url)].join(' '),
      timestamp: Date.parse(s.createdAt),
      run: () => handleRestoreSession(s.id),
    }));
    const workspaceItems: PaletteItem[] = workspaces.map((workspace) => ({
      id: `ws-${workspace.id}`,
      title: workspace.name,
      subtitle: `${workspace.tabs.length} saved tabs`,
      kind: 'workspace',
      searchText: [
        ...(workspace.tags ?? []),
        workspace.note ?? '',
        ...workspace.tabs.map((tab) => tab.url),
      ].join(' '),
      run: () => handleSwitchWorkspace(workspace.id),
    }));
    // Durable recall: pages Perch has held that aren't already shown above.
    const liveUrls = new Set<string>([
      ...realTabs.map((t) => t.url),
      ...deferred.active.map((d) => d.url),
    ]);
    const historyItems: PaletteItem[] = history
      .filter((h) => !liveUrls.has(h.url))
      .map((h) => {
        const hostname = hostOf(h.url);
        return {
          id: `hist-${h.url}`,
          title: h.title || h.url,
          subtitle: hostname,
          kind: 'history',
          hostname,
          timestamp: h.ts,
          run: () => openUrl(h.url),
        };
      });
    // Verb actions — run a command straight from the palette.
    const actionItems: PaletteItem[] = [
      {
        id: 'act-stash-all',
        title: 'Stash all tabs',
        subtitle: 'Command',
        kind: 'action',
        run: handleStashAll,
      },
      {
        id: 'act-close-all',
        title: 'Close all tabs',
        subtitle: 'Command',
        kind: 'action',
        run: handleCloseAll,
      },
      {
        id: 'act-suspend',
        title: 'Suspend inactive tabs',
        subtitle: 'Command',
        kind: 'action',
        run: handleSuspend,
      },
      {
        id: 'act-new-ws',
        title: 'New workspace',
        subtitle: 'Command',
        kind: 'action',
        run: handleCreateWorkspace,
      },
      {
        id: 'act-settings',
        title: 'Open settings',
        subtitle: 'Command',
        kind: 'action',
        run: () => setSettingsOpen(true),
      },
      ...(recentlyClosed.length > 0
        ? [
            {
              id: 'act-undo',
              title: 'Undo last close',
              subtitle: 'Command',
              kind: 'action' as const,
              run: handleUndo,
            },
          ]
        : []),
    ];
    return [
      ...tabItems,
      ...savedItems,
      ...sessionItems,
      ...workspaceItems,
      ...actionItems,
      ...historyItems,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTabs, deferred.active, sessions, workspaces, history, recentlyClosed.length]);

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  // A chip is shown once per URL (deduped), so a selected chip represents every open
  // tab with that URL. Expand the selection to all those tab ids before acting.
  const selectedUrlSet = (): Set<string> =>
    new Set(realTabs.filter((t) => t.id !== undefined && selected.has(t.id)).map((t) => t.url));

  const expandedSelectedIds = (): number[] => {
    const urls = selectedUrlSet();
    return realTabs
      .filter((t) => urls.has(t.url))
      .map((t) => t.id)
      .filter((id): id is number => id !== undefined);
  };

  const selectedTabInfos = (): { url: string; title: string }[] => {
    const urls = selectedUrlSet();
    const seen = new Set<string>();
    const out: { url: string; title: string }[] = [];
    for (const t of realTabs) {
      if (urls.has(t.url) && !seen.has(t.url)) {
        seen.add(t.url);
        out.push({ url: t.url, title: t.title });
      }
    }
    return out;
  };

  const handleBulkStash = async () => {
    const tabs = toStashedTabs(selectedTabInfos());
    if (tabs.length === 0) return;
    await saveSession('Selected tabs', tabs);
    await closeTabsByIds(expandedSelectedIds());
    clearSelection();
    showToast(`Stashed ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleBulkSave = async () => {
    const tabs = selectedTabInfos();
    if (tabs.length === 0) return;
    for (const t of tabs) await deferred.save(t);
    await closeTabsByIds(expandedSelectedIds());
    clearSelection();
    showToast(`Saved ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleBulkClose = async () => {
    const stashed = toStashedTabs(selectedTabInfos());
    if (stashed.length === 0) return;
    await pushClosed(`${stashed.length} tabs`, stashed);
    await closeTabsByIds(expandedSelectedIds());
    clearSelection();
    showToast(`Closed ${stashed.length} tab${stashed.length !== 1 ? 's' : ''}`, () => handleUndo());
    await refresh();
  };

  return (
    <div className="container">
      <header>
        <div className="header-left">
          <div className="wordmark" aria-label="Perch">
            <PerchMark className="wordmark-icon" />
            <span>Perch</span>
          </div>
          <h1 id="greeting">{greeting}</h1>
          <div className="date">{dateDisplay}</div>
        </div>
        <div className="toolbar">
          <button
            className="search-field"
            onClick={openPalette}
            aria-label="Search tabs, saved, and stashes"
          >
            <SearchIcon />
            <span className="search-field-text">Search tabs…</span>
            <kbd>{SEARCH_HINT}</kbd>
          </button>
          {recentlyClosed.length > 0 && (
            <button
              className="tool-btn"
              onClick={handleUndo}
              aria-label="Reopen the last closed tabs"
              title="Reopen the last closed tabs"
            >
              <UndoIcon />
              Undo
            </button>
          )}
          {canSuspend > 0 && (
            <button
              className="tool-btn"
              onClick={handleSuspend}
              aria-label="Suspend inactive tabs to free memory"
              title="Suspend inactive tabs to free memory"
            >
              <MoonIcon />
              Suspend {canSuspend}
            </button>
          )}
          <button
            className="tool-btn"
            onClick={() => setControlOpen(true)}
            aria-label="Open recovery, health, and automation"
            title="Recovery, health, and automation"
          >
            Control
          </button>
          <button
            className="tool-btn icon-only"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {workspaces.length > 0 && (
        <WorkspaceBar
          workspaces={workspaces}
          activeId={activeWorkspaceId}
          onSwitch={handleSwitchWorkspace}
          onCreate={handleCreateWorkspace}
          onRename={handleRenameWorkspace}
          onDelete={handleDeleteWorkspace}
        />
      )}

      {realTabs.length > 0 && (
        <section className="overview-card" aria-label="Tab overview">
          <div className="overview-copy">
            <span className="overview-eyebrow">Right now</span>
            <strong>
              {canSuspend > 0
                ? `${canSuspend} tab${canSuspend !== 1 ? 's are' : ' is'} ready to sleep`
                : stale.length > 0
                  ? `${stale.length} old tab${stale.length !== 1 ? 's need' : ' needs'} a decision`
                  : 'Your tabs are in good shape'}
            </strong>
            <span>
              {canSuspend > 0
                ? `Suspend them without closing anything and free about ${formatFreed(canSuspend)}.`
                : stale.length > 0
                  ? `These tabs have not been opened in at least ${settings.staleDays} days.`
                  : `${realTabs.length} tabs are organized across ${groups.length} groups.`}
            </span>
          </div>
          <div className="overview-metrics" aria-label="Current tab metrics">
            <div>
              <strong>{realTabs.length}</strong>
              <span>tabs</span>
            </div>
            <div>
              <strong>{groups.length}</strong>
              <span>spaces</span>
            </div>
            <div className={duplicateExtras > 0 ? 'has-attention' : ''}>
              <strong>{duplicateExtras}</strong>
              <span>duplicates</span>
            </div>
            <div className={stale.length > 0 ? 'has-attention' : ''}>
              <strong>{stale.length}</strong>
              <span>stale</span>
            </div>
          </div>
          <div className="overview-actions">
            {canSuspend > 0 ? (
              <button className="overview-primary" onClick={handleSuspend}>
                <MoonIcon /> Suspend {canSuspend}
              </button>
            ) : stale.length > 0 ? (
              <button className="overview-primary" onClick={() => handleStashStale(stale)}>
                <StashIcon /> Stash stale
              </button>
            ) : largestGroup ? (
              <button className="overview-primary" onClick={() => handleFocusGroup(largestGroup)}>
                Focus {groupLabel(largestGroup)}
              </button>
            ) : null}
            <button className="overview-secondary" onClick={handleCreateRoutine}>
              Save today as a routine
            </button>
          </div>
        </section>
      )}

      {tabOutCount > 1 && !dupeDismissed && (
        <DupeBanner count={tabOutCount} onClose={handleTabOutDupes} onDismiss={snoozeDupe} />
      )}
      {stale.length > 0 && !staleDismissed && (
        <StaleBanner
          count={stale.length}
          days={settings.staleDays}
          onStash={() => handleStashStale(stale)}
          onClose={() => handleCloseStale(stale)}
          onDismiss={snoozeStale}
        />
      )}

      <div className="dashboard-columns">
        <div className="active-section">
          <div className="section-header">
            <h2>Open tabs</h2>
            <div className="section-line"></div>
            <div className="section-count">
              {groups.length > 0 ? (
                <>
                  <span>
                    {groups.length} group{groups.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="action-btn"
                    aria-pressed={selectMode}
                    onClick={() => {
                      setSelectMode((v) => {
                        if (v) clearSelection();
                        return !v;
                      });
                    }}
                  >
                    {selectMode ? 'Done' : 'Select'}
                  </button>
                  <button className="action-btn" onClick={handleStashAll}>
                    <StashIcon /> Stash all
                  </button>
                  <button className="action-btn close-tabs" onClick={handleCloseAll}>
                    <CloseIcon /> Close all
                  </button>
                </>
              ) : (
                'All clear'
              )}
            </div>
          </div>

          <div className={`missions${selectMode || selected.size > 0 ? ' selecting' : ''}`}>
            {groups.length > 0 ? (
              groups.map((group) => (
                <DomainCard
                  key={group.domain}
                  group={group}
                  selectedIds={selected}
                  selecting={selectMode || selected.size > 0}
                  onToggleSelect={toggleSelect}
                  onCloseGroup={handleCloseGroup}
                  onStashGroup={handleStashGroup}
                  onDedup={handleDedup}
                  onFocus={handleFocus}
                  onSave={handleSaveTab}
                  onCloseTab={handleCloseTab}
                  onGroupInBrowser={handleGroupInBrowser}
                  onUngroup={handleUngroup}
                  onFocusGroup={handleFocusGroup}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="sidebar">
          {sessions.length > 0 && (
            <Sessions
              sessions={sessions}
              onRestore={handleRestoreSession}
              onRestoreNewWindow={handleRestoreNewWindow}
              onRename={handleRenameSession}
              onDelete={handleDeleteSession}
              onMeta={(id, tags, note) => updateSessionMeta(id, { tags, note })}
              onReorder={handleReorderSession}
              onDropToSession={handleDropToSession}
              onCreateStashFromDrop={handleCreateStashFromDrop}
            />
          )}
          {routines.length > 0 && (
            <Routines
              routines={routines}
              canCreate={realTabs.length > 0}
              onCreate={handleCreateRoutine}
              onOpen={handleOpenRoutine}
              onOpenNewWindow={handleOpenRoutineNewWindow}
              onRename={handleRenameRoutine}
              onSchedule={setRoutineSchedule}
              onDelete={handleDeleteRoutine}
            />
          )}
          {(deferred.active.length > 0 || deferred.archived.length > 0) && (
            <SavedForLater
              active={deferred.active}
              archived={deferred.archived}
              onCheck={deferred.checkOff}
              onDismiss={deferred.dismiss}
              onMeta={deferred.updateMeta}
              onDropSave={handleDropSave}
            />
          )}
          {sessions.length === 0 &&
            routines.length === 0 &&
            deferred.active.length === 0 &&
            deferred.archived.length === 0 && (
              <div className="shelf-empty">
                <span className="overview-eyebrow">Your shelf</span>
                <strong>Keep something worth returning to.</strong>
                <p>Stash a group, save a tab, or capture today as a reusable routine.</p>
                <button className="overview-secondary" onClick={handleCreateRoutine}>
                  Save current tabs
                </button>
              </div>
            )}
        </aside>
      </div>

      <footer>
        <span className="credit">Built by Piyush Gambhir</span>
      </footer>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <div className="bulk-actions">
            <button className="action-btn" onClick={handleBulkStash}>
              <StashIcon /> Stash
            </button>
            <button className="action-btn" onClick={handleBulkSave}>
              Save
            </button>
            <button className="action-btn close-tabs" onClick={handleBulkClose}>
              <CloseIcon /> Close
            </button>
            <button className="action-btn" onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <ControlCenter
        open={controlOpen}
        tabs={realTabs}
        onClose={() => setControlOpen(false)}
        onRefresh={refresh}
      />
      {firstRun.show && <FirstRunTour onDismiss={firstRun.dismiss} />}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}
