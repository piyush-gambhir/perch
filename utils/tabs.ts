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
      isPerchTab: t.url === ntUrl || t.url === 'chrome://newtab/',
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
    const api = getTabGroupsApi();
    if (!api) return [];
    const groups = await api.query({});
    return groups.map((g) => ({ id: g.id, title: g.title ?? '', color: g.color }));
  } catch {
    return [];
  }
}

// Typed surface for the tabGroups API + tabs.group/ungroup, which webextension-polyfill
// does not always type. Localized here so the rest of the code stays cast-free.
interface TabGroupsApi {
  query: (q: Record<string, unknown>) => Promise<{ id: number; title?: string; color: string }[]>;
  update: (id: number, props: { title?: string }) => Promise<unknown>;
}
interface TabsGroupApi {
  group: (opts: { tabIds: number[] }) => Promise<number>;
  ungroup: (ids: number[]) => Promise<void>;
}
// Accessed lazily (browser is undefined outside the extension, e.g. in unit tests).
const getTabGroupsApi = (): TabGroupsApi | undefined =>
  (browser as unknown as { tabGroups?: TabGroupsApi } | undefined)?.tabGroups;
const getTabsGroupApi = (): TabsGroupApi => browser.tabs as unknown as TabsGroupApi;

/**
 * Create a native Chrome tab group from these tabs and name it. Tabs are grouped
 * per-window (Chrome requires a single window per group). Best-effort.
 */
export async function groupTabsInBrowser(
  tabs: { id?: number; windowId?: number }[],
  title: string,
): Promise<void> {
  const api = getTabGroupsApi();
  if (!api) return;
  const tabsApi = getTabsGroupApi();
  const byWindow = new Map<number, number[]>();
  for (const t of tabs) {
    if (t.id === undefined || t.windowId === undefined) continue;
    const arr = byWindow.get(t.windowId) ?? [];
    arr.push(t.id);
    byWindow.set(t.windowId, arr);
  }
  for (const ids of byWindow.values()) {
    if (ids.length === 0) continue;
    try {
      const groupId = await tabsApi.group({ tabIds: ids });
      await api.update(groupId, { title });
    } catch {
      /* grouping unavailable or tabs moved — skip this window */
    }
  }
}

/** Ungroup every tab in the given native group. */
export async function ungroupTabsInBrowser(groupId: number): Promise<void> {
  try {
    const all = await browser.tabs.query({});
    const ids = all
      .filter((t) => (t as { groupId?: number }).groupId === groupId)
      .map((t) => t.id)
      .filter((id): id is number => id !== undefined);
    if (ids.length > 0) await getTabsGroupApi().ungroup(ids);
  } catch {
    /* best-effort */
  }
}

/** Count real web tabs (skips browser internals). Used by the badge. */
export async function countRealTabs(): Promise<number> {
  const tabs = await browser.tabs.query({});
  return tabs.filter((t) => !isInternalUrl(t.url ?? '')).length;
}

/** Close the exact tabs with these ids. The precise, safe way to close a card's tabs. */
export async function closeTabsByIds(ids: (number | undefined)[]): Promise<void> {
  const real = ids.filter((id): id is number => id !== undefined);
  if (real.length > 0) await browser.tabs.remove(real);
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

/** Open many URLs as background tabs. Resilient: one bad URL won't abort the rest. */
export async function openUrls(urls: string[], windowId?: number): Promise<void> {
  for (const url of urls) {
    if (!url) continue;
    try {
      await browser.tabs.create(
        windowId !== undefined ? { url, active: false, windowId } : { url, active: false },
      );
    } catch {
      /* skip an unopenable URL */
    }
  }
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
  return tabs.filter((t) => !t.active && !t.discarded && !t.isPerchTab && !isInternalUrl(t.url))
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
