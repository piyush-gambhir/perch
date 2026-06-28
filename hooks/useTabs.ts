/**
 * useTabs — live view of open browser tabs.
 *
 * Fetches tabs + native tab groups, subscribes to tab and tab-group events, and
 * exposes the grouped/derived data the dashboard renders. The dashboard updates
 * automatically as tabs change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { groupTabs } from '../utils/grouping';
import { fetchOpenTabs, fetchTabGroups, isInternalUrl } from '../utils/tabs';
import type { DomainGroup, NativeGroup, TabInfo } from '../utils/types';

export interface UseTabs {
  tabs: TabInfo[];
  realTabs: TabInfo[];
  groups: DomainGroup[];
  nativeGroups: NativeGroup[];
  tabOutCount: number;
  refresh: () => Promise<void>;
}

// chrome.tabGroups may be absent in older browsers; guard access.
const tabGroupEvents = (
  browser as unknown as {
    tabGroups?: {
      onCreated?: {
        addListener: (cb: () => void) => void;
        removeListener: (cb: () => void) => void;
      };
      onUpdated?: {
        addListener: (cb: () => void) => void;
        removeListener: (cb: () => void) => void;
      };
      onRemoved?: {
        addListener: (cb: () => void) => void;
        removeListener: (cb: () => void) => void;
      };
      onMoved?: { addListener: (cb: () => void) => void; removeListener: (cb: () => void) => void };
    };
  }
).tabGroups;

export function useTabs(): UseTabs {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [nativeGroups, setNativeGroups] = useState<NativeGroup[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const [t, g] = await Promise.all([fetchOpenTabs(), fetchTabGroups()]);
    setTabs(t);
    setNativeGroups(g);
  }, []);

  useEffect(() => {
    refresh();

    // Coalesce rapid event bursts (e.g. closing a group) into one refetch.
    const scheduleRefresh = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(refresh, 80);
    };

    browser.tabs.onCreated.addListener(scheduleRefresh);
    browser.tabs.onRemoved.addListener(scheduleRefresh);
    browser.tabs.onUpdated.addListener(scheduleRefresh);
    tabGroupEvents?.onCreated?.addListener(scheduleRefresh);
    tabGroupEvents?.onUpdated?.addListener(scheduleRefresh);
    tabGroupEvents?.onRemoved?.addListener(scheduleRefresh);
    tabGroupEvents?.onMoved?.addListener(scheduleRefresh);

    return () => {
      browser.tabs.onCreated.removeListener(scheduleRefresh);
      browser.tabs.onRemoved.removeListener(scheduleRefresh);
      browser.tabs.onUpdated.removeListener(scheduleRefresh);
      tabGroupEvents?.onCreated?.removeListener(scheduleRefresh);
      tabGroupEvents?.onUpdated?.removeListener(scheduleRefresh);
      tabGroupEvents?.onRemoved?.removeListener(scheduleRefresh);
      tabGroupEvents?.onMoved?.removeListener(scheduleRefresh);
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [refresh]);

  const realTabs = useMemo(() => tabs.filter((t) => !isInternalUrl(t.url)), [tabs]);
  const groups = useMemo(() => groupTabs(realTabs, { nativeGroups }), [realTabs, nativeGroups]);
  const tabOutCount = useMemo(() => tabs.filter((t) => t.isTabOut).length, [tabs]);

  return { tabs, realTabs, groups, nativeGroups, tabOutCount, refresh };
}
