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

/** Decoded name of one raw `key=value` query pair, as URLSearchParams would read it. */
function paramName(pair: string): string {
  const key = (pair.split('=')[0] ?? '').replace(/\+/g, ' ');
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/**
 * Drop tracking parameters and nothing else. The fragment stays (hash-routed apps keep
 * their route in it, e.g. `#/document/123`), and the remaining pairs keep their exact
 * original encoding, so the cleaned URL still opens the same page.
 */
export function stripTrackingParams(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.search) return raw;
    const kept = url.search
      .slice(1)
      .split('&')
      .filter((pair) => !TRACKING.includes(paramName(pair)));
    url.search = kept.length ? `?${kept.join('&')}` : '';
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
  // Exact URLs, the same rule closeDuplicateTabs cleans with, so every reported
  // duplicate is one the cleanup button can actually close.
  const counts = new Map<string, number>();
  tabs.forEach((tab) => counts.set(tab.url, (counts.get(tab.url) ?? 0) + 1));
  return {
    duplicates: tabs.filter((tab) => (counts.get(tab.url) ?? 0) > 1),
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
