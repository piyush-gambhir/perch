/**
 * Thin typed wrappers over the browser tabs/windows API. Each function does one
 * Chrome operation; the React hooks compose these and manage state.
 */

import { browser } from 'wxt/browser';
import type { NativeGroup, StashedTab, TabInfo } from './types';

const INTERNAL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];

/** True for browser-internal / extension pages we never want to show or count. */
export function isInternalUrl(url: string): boolean {
  return INTERNAL_PREFIXES.some((p) => url.startsWith(p));
}

/** The URL of Perch's own new-tab page. */
function newtabUrl(): string {
  return browser.runtime.getURL('/newtab.html');
}

function stash(t: { url?: string; title?: string }): StashedTab {
  return { url: t.url ?? '', title: t.title || t.url || '' };
}

/** Read all open tabs, normalized to TabInfo. */
export async function fetchOpenTabs(): Promise<TabInfo[]> {
  try {
    const ntUrl = newtabUrl();
    const tabs = await browser.tabs.query({});
    return tabs.map((t) => ({
      id: t.id,
      url: t.url ?? '',
      title: t.title ?? '',
      windowId: t.windowId,
      active: t.active ?? false,
      isTabOut: t.url === ntUrl || t.url === 'chrome://newtab/',
      lastAccessed: (t as { lastAccessed?: number }).lastAccessed,
      discarded: t.discarded ?? false,
      groupId: (t as { groupId?: number }).groupId ?? -1,
    }));
  } catch {
    return [];
  }
}

// Chrome tab-group color names → hex (for the card's color dot).
const TAB_GROUP_COLORS: Record<string, string> = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa903e',
};

export function tabGroupColor(name?: string): string {
  return (name && TAB_GROUP_COLORS[name]) || '#888888';
}

/** Read the browser's native tab groups. */
export async function fetchTabGroups(): Promise<NativeGroup[]> {
  try {
    const tabGroups = (
      browser as unknown as {
        tabGroups?: {
          query: (q: object) => Promise<{ id: number; title?: string; color: string }[]>;
        };
      }
    ).tabGroups;
    if (!tabGroups) return [];
    const groups = await tabGroups.query({});
    return groups.map((g) => ({ id: g.id, title: g.title ?? '', color: g.color }));
  } catch {
    return [];
  }
}

/** Create a native Chrome tab group from the given URLs and name it. */
export async function groupTabsInBrowser(urls: string[], title: string): Promise<void> {
  const urlSet = new Set(urls);
  const all = await browser.tabs.query({});
  const ids = all
    .filter((t) => urlSet.has(t.url ?? ''))
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length === 0) return;
  const groupId = await (
    browser.tabs as unknown as { group: (o: object) => Promise<number> }
  ).group({ tabIds: ids });
  try {
    await (
      browser as unknown as { tabGroups: { update: (id: number, p: object) => Promise<unknown> } }
    ).tabGroups.update(groupId, { title });
  } catch {
    /* naming is best-effort */
  }
}

/** Ungroup every tab in the given native group. */
export async function ungroupTabsInBrowser(groupId: number): Promise<void> {
  const all = await browser.tabs.query({});
  const ids = all
    .filter((t) => (t as { groupId?: number }).groupId === groupId)
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await (browser.tabs as unknown as { ungroup: (ids: number[]) => Promise<void> }).ungroup(ids);
  }
}

/** Count real web tabs (skips browser internals). Used by the badge. */
export async function countRealTabs(): Promise<number> {
  const tabs = await browser.tabs.query({});
  return tabs.filter((t) => !isInternalUrl(t.url ?? '')).length;
}

/** Close tabs by hostname match. file:// URLs are matched exactly. Returns closed tabs. */
export async function closeTabsByUrls(urls: string[]): Promise<StashedTab[]> {
  if (!urls || urls.length === 0) return [];

  const targetHostnames: string[] = [];
  const exactUrls = new Set<string>();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try {
        targetHostnames.push(new URL(u).hostname);
      } catch {
        /* skip */
      }
    }
  }

  const allTabs = await browser.tabs.query({});
  const matched = allTabs.filter((tab) => {
    const tabUrl = tab.url ?? '';
    if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
    try {
      const tabHostname = new URL(tabUrl).hostname;
      return !!tabHostname && targetHostnames.includes(tabHostname);
    } catch {
      return false;
    }
  });
  const toClose = matched.map((t) => t.id).filter((id): id is number => id !== undefined);
  if (toClose.length > 0) await browser.tabs.remove(toClose);
  return matched.map(stash);
}

/** Close tabs by exact URL match (used for homepages/custom groups). Returns closed tabs. */
export async function closeTabsExact(urls: string[]): Promise<StashedTab[]> {
  if (!urls || urls.length === 0) return [];
  const urlSet = new Set(urls);
  const allTabs = await browser.tabs.query({});
  const matched = allTabs.filter((t) => urlSet.has(t.url ?? ''));
  const toClose = matched.map((t) => t.id).filter((id): id is number => id !== undefined);
  if (toClose.length > 0) await browser.tabs.remove(toClose);
  return matched.map(stash);
}

/** Close a single tab by exact URL. Returns the closed tab (for undo). */
export async function closeTabByUrl(url: string): Promise<StashedTab[]> {
  const allTabs = await browser.tabs.query({});
  const match = allTabs.find((t) => t.url === url);
  if (match?.id !== undefined) {
    await browser.tabs.remove(match.id);
    return [stash(match)];
  }
  return [];
}

/** Open a URL in a new active tab (used for non-open results in the palette). */
export async function openUrl(url: string): Promise<void> {
  if (!url) return;
  await browser.tabs.create({ url, active: true });
}

/** Focus the tab with the given URL (exact, then hostname fallback), across windows. */
export async function focusTab(url: string): Promise<void> {
  if (!url) return;
  const allTabs = await browser.tabs.query({});
  const currentWindow = await browser.windows.getCurrent();

  let matches = allTabs.filter((t) => t.url === url);
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter((t) => {
        try {
          return new URL(t.url ?? '').hostname === targetHost;
        } catch {
          return false;
        }
      });
    } catch {
      /* ignore */
    }
  }
  if (matches.length === 0) return;

  const match = matches.find((t) => t.windowId !== currentWindow.id) || matches[0];
  if (match.id !== undefined) await browser.tabs.update(match.id, { active: true });
  if (match.windowId !== undefined) await browser.windows.update(match.windowId, { focused: true });
}

/** Close duplicate tabs. keepOne=true keeps one copy of each URL. */
export async function closeDuplicateTabs(urls: string[], keepOne = true): Promise<void> {
  const allTabs = await browser.tabs.query({});
  const toClose: number[] = [];

  for (const url of urls) {
    const matching = allTabs.filter((t) => t.url === url);
    if (keepOne) {
      const keep = matching.find((t) => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== undefined && tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) if (tab.id !== undefined) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await browser.tabs.remove(toClose);
}

/** Close all duplicate Tab Out new-tab pages except the current one. */
export async function closeTabOutDupes(): Promise<void> {
  const ntUrl = newtabUrl();
  const allTabs = await browser.tabs.query({});
  const currentWindow = await browser.windows.getCurrent();
  const tabOutTabs = allTabs.filter((t) => t.url === ntUrl || t.url === 'chrome://newtab/');
  if (tabOutTabs.length <= 1) return;

  const keep =
    tabOutTabs.find((t) => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find((t) => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs
    .filter((t) => t.id !== keep.id)
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (toClose.length > 0) await browser.tabs.remove(toClose);
}

/* ---- Memory saver: suspend (discard) inactive tabs ---- */

/** Rough per-tab memory estimate (MB) for the "freed ~X" readout. */
export const APPROX_MB_PER_TAB = 80;

/** Tabs eligible to discard: real, not active, not already discarded. */
export function discardableCount(tabs: TabInfo[]): number {
  return tabs.filter((t) => !t.active && !t.discarded && !t.isTabOut && !isInternalUrl(t.url))
    .length;
}

/** Discard all inactive, non-discarded real tabs. Returns how many were suspended. */
export async function suspendInactiveTabs(): Promise<number> {
  const tabs = await browser.tabs.query({});
  let count = 0;
  for (const t of tabs) {
    const url = t.url ?? '';
    if (t.active || t.discarded || isInternalUrl(url) || t.id === undefined) continue;
    try {
      await browser.tabs.discard(t.id);
      count += 1;
    } catch {
      /* some tabs (e.g. playing audio) can't be discarded — skip */
    }
  }
  return count;
}
