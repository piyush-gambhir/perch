import type { TabInfo } from './types';

export interface TabHealth {
  duplicates: TabInfo[];
  stale: TabInfo[];
  tracking: TabInfo[];
  discardable: TabInfo[];
}

const TRACKING = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
];

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    TRACKING.forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

export function hasTrackingParameters(raw: string): boolean {
  try {
    const url = new URL(raw);
    return TRACKING.some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}

export function analyzeTabHealth(tabs: TabInfo[], now = Date.now()): TabHealth {
  const counts = new Map<string, number>();
  tabs.forEach((tab) =>
    counts.set(canonicalUrl(tab.url), (counts.get(canonicalUrl(tab.url)) ?? 0) + 1),
  );
  return {
    duplicates: tabs.filter((tab) => (counts.get(canonicalUrl(tab.url)) ?? 0) > 1),
    stale: tabs.filter(
      (tab) =>
        !tab.active &&
        !tab.pinned &&
        !!tab.lastAccessed &&
        now - tab.lastAccessed > 30 * 86_400_000,
    ),
    tracking: tabs.filter((tab) => hasTrackingParameters(tab.url)),
    discardable: tabs.filter((tab) => !tab.active && !tab.pinned && !tab.audible && !tab.discarded),
  };
}
