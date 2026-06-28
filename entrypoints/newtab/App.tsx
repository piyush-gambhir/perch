/** Perch dashboard — the new-tab page. Composes hooks + components. */

import { useEffect, useMemo, useState } from 'react';
import { CommandPalette, type PaletteItem } from '../../components/CommandPalette';
import { DomainCard } from '../../components/DomainCard';
import { DupeBanner } from '../../components/DupeBanner';
import {
  CheckIcon,
  CloseIcon,
  GearIcon,
  MoonIcon,
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
import { useDeferred } from '../../hooks/useDeferred';
import { useRoutines } from '../../hooks/useRoutines';
import { useSessions } from '../../hooks/useSessions';
import { useSettings } from '../../hooks/useSettings';
import { useTabs } from '../../hooks/useTabs';
import { deleteRoutine, openRoutine, renameRoutine, saveRoutine } from '../../utils/routines';
import { displayTitle, friendlyDomain, getDateDisplay, getGreeting } from '../../utils/format';
import type { DragTab } from '../../utils/dnd';
import {
  addTabsToSession,
  deleteSession,
  pushClosed,
  renameSession,
  reorderSessions,
  restoreSession,
  saveSession,
  toStashedTabs,
  undoLastClose,
} from '../../utils/sessions';
import { staleTabs } from '../../utils/stale';
import {
  APPROX_MB_PER_TAB,
  closeDuplicateTabs,
  closeTabByUrl,
  closeTabOutDupes,
  closeTabsByUrls,
  closeTabsExact,
  discardableCount,
  focusTab,
  groupTabsInBrowser,
  openUrl,
  suspendInactiveTabs,
  ungroupTabsInBrowser,
} from '../../utils/tabs';
import type { DomainGroup, TabInfo } from '../../utils/types';
import { LANDING_PAGES_KEY } from '../../utils/types';

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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function formatFreed(n: number): string {
  const mb = n * APPROX_MB_PER_TAB;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function Dashboard() {
  const { realTabs, groups, tabOutCount, refresh } = useTabs();
  const deferred = useDeferred();
  const { sessions, recentlyClosed } = useSessions();
  const { routines } = useRoutines();
  const { settings, update: updateSettings } = useSettings();
  const showToast = useToast();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [dupeDismissed, setDupeDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const greeting = useMemo(() => getGreeting(), []);
  const dateDisplay = useMemo(() => getDateDisplay(), []);
  const stale = useMemo(
    () => staleTabs(realTabs, Date.now(), settings.staleDays),
    [realTabs, settings.staleDays],
  );
  const canSuspend = useMemo(() => discardableCount(realTabs), [realTabs]);

  // Keyboard: Cmd/Ctrl+K or "/" opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '/' && !typing && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  const groupLabel = (g: DomainGroup) =>
    g.domain === LANDING_PAGES_KEY ? 'Homepages' : g.label || friendlyDomain(g.domain);

  const closeGroupTabs = (g: DomainGroup) => {
    const urls = g.tabs.map((t) => t.url);
    const useExact = g.domain === LANDING_PAGES_KEY || !!g.label;
    return useExact ? closeTabsExact(urls) : closeTabsByUrls(urls);
  };

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
    const closed = await closeGroupTabs(group);
    await pushClosed(groupLabel(group), closed);
    showToast(`Closed ${closed.length} tab${closed.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleStashGroup = async (group: DomainGroup) => {
    const tabs = toStashedTabs(group.tabs);
    if (tabs.length === 0) return;
    await saveSession(groupLabel(group), tabs);
    await closeGroupTabs(group);
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
    const closed = await closeTabsByUrls(realTabs.map((t) => t.url));
    await pushClosed(`${closed.length} tabs`, closed);
    showToast('All tabs closed. Fresh start.');
    await refresh();
  };

  const handleStashAll = async () => {
    const tabs = toStashedTabs(realTabs);
    if (tabs.length === 0) return;
    await saveSession('All tabs', tabs);
    await closeTabsByUrls(realTabs.map((t) => t.url));
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
    const ok = await undoLastClose();
    showToast(ok ? 'Reopened' : 'Nothing to undo');
    await refresh();
  };

  const handleRestoreSession = async (id: string) => {
    await restoreSession(id, { remove: true });
    showToast('Stash restored');
    await refresh();
  };

  const handleRestoreNewWindow = async (id: string) => {
    await restoreSession(id, { remove: true, newWindow: true });
    showToast('Opened in a new window');
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

  const handleStashStale = async (tabs: TabInfo[]) => {
    const stashed = toStashedTabs(tabs);
    if (stashed.length === 0) return;
    await saveSession('Stale tabs', stashed);
    await closeTabsExact(stashed.map((t) => t.url));
    setStaleDismissed(true);
    showToast(`Stashed ${stashed.length} stale tab${stashed.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleCloseStale = async (tabs: TabInfo[]) => {
    const closed = await closeTabsExact(tabs.map((t) => t.url));
    await pushClosed('Stale tabs', closed);
    setStaleDismissed(true);
    showToast(`Closed ${closed.length} stale tab${closed.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleTabOutDupes = async () => {
    await closeTabOutDupes();
    showToast('Closed extra Perch tabs');
    await refresh();
  };

  const handleGroupInBrowser = async (group: DomainGroup) => {
    await groupTabsInBrowser(
      group.tabs.map((t) => t.url),
      groupLabel(group),
    );
    showToast(`Grouped in browser`);
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
      .filter((t) => !t.isTabOut)
      .map((t) => {
        const hostname = hostOf(t.url);
        return {
          id: `tab-${t.id ?? t.url}`,
          title: displayTitle(t.title || '', t.url, hostname) || t.url,
          subtitle: hostname || t.url,
          kind: 'tab',
          hostname,
          run: () => focusTab(t.url),
        };
      });
    const savedItems: PaletteItem[] = deferred.active.map((d) => {
      const hostname = hostOf(d.url);
      return {
        id: `saved-${d.id}`,
        title: d.title || d.url,
        subtitle: hostname,
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
      run: () => handleRestoreSession(s.id),
    }));
    return [...tabItems, ...savedItems, ...sessionItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTabs, deferred.active, sessions]);

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const selectedTabInfos = (): { url: string; title: string }[] => {
    const seen = new Set<string>();
    const out: { url: string; title: string }[] = [];
    for (const t of realTabs) {
      if (selected.has(t.url) && !seen.has(t.url)) {
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
    await closeTabsExact([...selected]);
    clearSelection();
    showToast(`Stashed ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleBulkSave = async () => {
    const tabs = selectedTabInfos();
    for (const t of tabs) await deferred.save(t);
    await closeTabsExact([...selected]);
    clearSelection();
    showToast(`Saved ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  const handleBulkClose = async () => {
    const closed = await closeTabsExact([...selected]);
    await pushClosed(`${closed.length} tabs`, closed);
    clearSelection();
    showToast(`Closed ${closed.length} tab${closed.length !== 1 ? 's' : ''}`);
    await refresh();
  };

  return (
    <div className="container">
      <header>
        <div className="header-left">
          <h1 id="greeting">{greeting}</h1>
          <div className="date">{dateDisplay}</div>
        </div>
        <div className="toolbar">
          <button
            className="search-field"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search tabs, saved, and stashes"
          >
            <SearchIcon />
            <span className="search-field-text">Search tabs…</span>
            <kbd>⌘K</kbd>
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
            className="tool-btn icon-only"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {tabOutCount > 1 && !dupeDismissed && (
        <DupeBanner
          count={tabOutCount}
          onClose={handleTabOutDupes}
          onDismiss={() => setDupeDismissed(true)}
        />
      )}
      {stale.length > 0 && !staleDismissed && (
        <StaleBanner
          count={stale.length}
          onStash={() => handleStashStale(stale)}
          onClose={() => handleCloseStale(stale)}
          onDismiss={() => setStaleDismissed(true)}
        />
      )}

      <div className="dashboard-columns">
        <div className="active-section">
          <div className="section-header">
            <h2>{groups.length > 0 ? 'Open tabs' : 'Right now'}</h2>
            <div className="section-line"></div>
            <div className="section-count">
              {groups.length > 0 ? (
                <>
                  <span>
                    {groups.length} group{groups.length !== 1 ? 's' : ''}
                  </span>
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

          <div className={`missions${selected.size > 0 ? ' selecting' : ''}`}>
            {groups.length > 0 ? (
              groups.map((group) => (
                <DomainCard
                  key={group.domain}
                  group={group}
                  selectedUrls={selected}
                  onToggleSelect={toggleSelect}
                  onCloseGroup={handleCloseGroup}
                  onStashGroup={handleStashGroup}
                  onDedup={handleDedup}
                  onFocus={handleFocus}
                  onSave={handleSaveTab}
                  onCloseTab={handleCloseTab}
                  onGroupInBrowser={handleGroupInBrowser}
                  onUngroup={handleUngroup}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        <aside className="sidebar">
          <Sessions
            sessions={sessions}
            onRestore={handleRestoreSession}
            onRestoreNewWindow={handleRestoreNewWindow}
            onRename={handleRenameSession}
            onDelete={handleDeleteSession}
            onReorder={handleReorderSession}
            onDropToSession={handleDropToSession}
            onCreateStashFromDrop={handleCreateStashFromDrop}
          />
          <Routines
            routines={routines}
            canCreate={realTabs.length > 0}
            onCreate={handleCreateRoutine}
            onOpen={handleOpenRoutine}
            onOpenNewWindow={handleOpenRoutineNewWindow}
            onRename={handleRenameRoutine}
            onDelete={handleDeleteRoutine}
          />
          <SavedForLater
            active={deferred.active}
            archived={deferred.archived}
            onCheck={deferred.checkOff}
            onDismiss={deferred.dismiss}
            onDropSave={handleDropSave}
          />
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
