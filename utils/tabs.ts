




import { browser } from 'wxt/browser';
import { faviconSrc } from './format';
import type { NativeGroup, StashedTab, TabInfo } from './types';

const INTERNAL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'moz-extension://',
  'about:',
  'edge://',
  'brave://',
];


export function isInternalUrl(url: string): boolean {
  return INTERNAL_PREFIXES.some((p) => url.startsWith(p));
}


export function faviconFor(pageUrl: string, favIconUrl?: string): string {
  return faviconSrc(pageUrl, favIconUrl, {
    firefox: import.meta.env.BROWSER === 'firefox',


    extensionUrl: (path) => (browser.runtime.getURL as (path: string) => string)(path),
  });
}


function newtabUrl(): string {
  return browser.runtime.getURL('/newtab.html');
}

function stash(t: { url?: string; title?: string }): StashedTab {
  return { url: t.url ?? '', title: t.title || t.url || '' };
}


export async function fetchOpenTabs(): Promise<TabInfo[]> {
  try {
    const ntUrl = newtabUrl();
    const tabs = await browser.tabs.query({});


    return tabs
      .filter((t) => !t.incognito)
      .map((t) => ({
        id: t.id,
        url: t.url ?? '',
        title: t.title ?? '',
        windowId: t.windowId,
        active: t.active ?? false,
        isPerchTab: t.url === ntUrl || t.url === 'chrome://newtab/',
        lastAccessed: (t as { lastAccessed?: number }).lastAccessed,
        discarded: t.discarded ?? false,
        groupId: (t as { groupId?: number }).groupId ?? -1,
        pinned: t.pinned ?? false,
        audible: t.audible ?? false,
        favIconUrl: t.favIconUrl,
      }));
  } catch {
    return [];
  }
}


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



interface TabGroupsApi {
  query: (q: Record<string, unknown>) => Promise<{ id: number; title?: string; color: string }[]>;
  update: (id: number, props: { title?: string }) => Promise<unknown>;
}
interface TabsGroupApi {
  group: (opts: { tabIds: number[] }) => Promise<number>;
  ungroup: (ids: number[]) => Promise<void>;
}

const getTabGroupsApi = (): TabGroupsApi | undefined =>
  (browser as unknown as { tabGroups?: TabGroupsApi } | undefined)?.tabGroups;
const getTabsGroupApi = (): TabsGroupApi => browser.tabs as unknown as TabsGroupApi;





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

    }
  }
}


export async function ungroupTabsInBrowser(groupId: number): Promise<void> {
  try {
    const all = await browser.tabs.query({});
    const ids = all
      .filter((t) => (t as { groupId?: number }).groupId === groupId)
      .map((t) => t.id)
      .filter((id): id is number => id !== undefined);
    if (ids.length > 0) await getTabsGroupApi().ungroup(ids);
  } catch {

  }
}


export async function countRealTabs(): Promise<number> {
  const tabs = await browser.tabs.query({});
  return tabs.filter((t) => !t.incognito && !isInternalUrl(t.url ?? '')).length;
}







export async function closeTabsByIds(ids: (number | undefined)[]): Promise<void> {
  const real = ids.filter((id): id is number => id !== undefined);
  if (real.length === 0) return;
  try {
    await browser.tabs.remove(real);
  } catch {
    for (const id of real) {
      await browser.tabs.remove(id).catch(() => {});
    }
  }
}


export async function closeTabByUrl(url: string): Promise<StashedTab[]> {
  const allTabs = await browser.tabs.query({});
  const match = allTabs.find((t) => t.url === url);
  if (match?.id !== undefined) {
    await browser.tabs.remove(match.id);
    return [stash(match)];
  }
  return [];
}


export async function openUrl(url: string): Promise<void> {
  if (!url) return;
  await browser.tabs.create({ url, active: true });
}





export async function openStashedTabs(
  tabs: StashedTab[],
  options: { windowId?: number; skipOpen?: boolean } = {},
): Promise<{ opened: number; skipped: number; failed: StashedTab[] }> {
  const existing = options.skipOpen
    ? new Set(
        (await browser.tabs.query({})).map((tab) => tab.url).filter((url): url is string => !!url),
      )
    : new Set<string>();
  let opened = 0;
  let skipped = 0;
  const failed: StashedTab[] = [];
  for (const tab of tabs) {
    if (!tab.url || existing.has(tab.url)) {
      skipped += 1;
      continue;
    }
    try {
      await browser.tabs.create({
        url: tab.url,
        active: false,
        pinned: tab.pinned,
        ...(options.windowId !== undefined ? { windowId: options.windowId } : {}),
      });
      existing.add(tab.url);
      opened += 1;
    } catch {
      failed.push(tab);
    }
  }

  return { opened, skipped, failed: failed.filter((tab) => !existing.has(tab.url)) };
}


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

    }
  }
  if (matches.length === 0) return;


  const match = matches.find((t) => t.windowId === currentWindow.id) || matches[0];
  if (!match) return;
  if (match.id !== undefined) await browser.tabs.update(match.id, { active: true });
  if (match.windowId !== undefined) await browser.windows.update(match.windowId, { focused: true });
}






export async function closeDuplicateTabs(urls: string[], keepOne = true): Promise<void> {
  const allTabs = await browser.tabs.query({});
  const toClose: number[] = [];

  for (const url of new Set(urls)) {
    const matching = allTabs.filter((t) => t.url === url && !t.incognito);
    if (keepOne) {

      const keep = matching.find((t) => t.pinned) || matching.find((t) => t.active) || matching[0];
      if (!keep) continue;
      for (const tab of matching) {
        if (tab.id !== undefined && tab.id !== keep?.id && !tab.pinned) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) if (tab.id !== undefined && !tab.pinned) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await browser.tabs.remove(toClose);
}


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
  if (!keep) return;
  const toClose = tabOutTabs
    .filter((t) => t.id !== keep.id)
    .map((t) => t.id)
    .filter((id): id is number => id !== undefined);
  if (toClose.length > 0) await browser.tabs.remove(toClose);
}




export const APPROX_MB_PER_TAB = 80;


export function discardableCount(tabs: TabInfo[]): number {
  return tabs.filter(
    (t) =>
      !t.active &&
      !t.discarded &&
      !t.pinned &&
      !t.audible &&
      !t.isPerchTab &&
      !isInternalUrl(t.url),
  ).length;
}


export async function suspendInactiveTabs(): Promise<number> {
  return suspendWhere(() => true);
}


export async function suspendTabsExcept(keepIds: (number | undefined)[]): Promise<number> {
  const keep = new Set(keepIds.filter((id): id is number => id !== undefined));
  return suspendWhere((id) => !keep.has(id));
}


export async function suspendTabsByIds(ids: (number | undefined)[]): Promise<number> {
  const only = new Set(ids.filter((id): id is number => id !== undefined));
  return suspendWhere((id) => only.has(id));
}

async function suspendWhere(predicate: (id: number) => boolean): Promise<number> {
  const tabs = await browser.tabs.query({});
  let count = 0;
  for (const t of tabs) {
    const url = t.url ?? '';


    if (t.active || t.discarded || t.pinned || t.audible || isInternalUrl(url)) continue;
    if (t.id === undefined || !predicate(t.id)) continue;
    try {
      await browser.tabs.discard(t.id);
      count += 1;
    } catch {

    }
  }
  return count;
}
