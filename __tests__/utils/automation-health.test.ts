import { describe, expect, it } from 'vitest';
import { duplicateIdsToClose, tabsMatchingRule } from '../../utils/automation';
import { analyzeTabHealth, canonicalUrl } from '../../utils/health';
import type { AutomationRule, TabInfo } from '../../utils/types';

const NOW = Date.parse('2026-07-11T12:00:00Z');
const DAY = 86_400_000;
const tab = (url: string, patch: Partial<TabInfo> = {}): TabInfo => ({
  url,
  title: url,
  active: false,
  isPerchTab: false,
  ...patch,
});

describe('tabsMatchingRule', () => {
  const rule: AutomationRule = {
    id: 'r1',
    name: 'Old GitHub tabs',
    enabled: true,
    hostname: 'github.com',
    olderThanDays: 7,
    action: 'stash',
    excludePinned: true,
  };

  it('matches subdomains and age while protecting pinned tabs', () => {
    const tabs = [
      tab('https://github.com/openai', { lastAccessed: NOW - 8 * DAY }),
      tab('https://gist.github.com/a', { lastAccessed: NOW - 9 * DAY }),
      tab('https://github.com/new', { lastAccessed: NOW - DAY }),
      tab('https://github.com/pinned', { lastAccessed: NOW - 30 * DAY, pinned: true }),
      tab('https://example.com', { lastAccessed: NOW - 30 * DAY }),
    ];
    expect(tabsMatchingRule(rule, tabs, NOW).map((item) => item.url)).toEqual([
      'https://github.com/openai',
      'https://gist.github.com/a',
    ]);
  });

  it('returns nothing for a disabled rule', () => {
    expect(tabsMatchingRule({ ...rule, enabled: false }, [tab('https://github.com')], NOW)).toEqual(
      [],
    );
  });
});

describe('duplicateIdsToClose', () => {
  const url = 'https://github.com/openai';
  const rule: AutomationRule = {
    id: 'r2',
    name: 'Old duplicates',
    enabled: true,
    hostname: 'github.com',
    olderThanDays: 7,
    action: 'close-duplicates',
    excludePinned: true,
  };

  it('closes only the copies the age limit matched', () => {
    const tabs = [
      tab(url, { id: 1, lastAccessed: NOW - 10 * DAY }),
      tab(url, { id: 2, lastAccessed: NOW - DAY }),
      tab(url, { id: 3, active: true, lastAccessed: NOW }),
    ];
    const matches = tabsMatchingRule(rule, tabs, NOW);
    expect(duplicateIdsToClose(matches, tabs)).toEqual([1]);
  });

  it('keeps one copy when every copy matched, preferring the active one', () => {
    const tabs = [
      tab(url, { id: 1, lastAccessed: NOW - 10 * DAY }),
      tab(url, { id: 2, active: true, lastAccessed: NOW - 9 * DAY }),
      tab(url, { id: 3, lastAccessed: NOW - 8 * DAY }),
    ];
    const matches = tabsMatchingRule(rule, tabs, NOW);
    expect(duplicateIdsToClose(matches, tabs)).toEqual([1, 3]);
  });

  it('leaves a single matched copy and pinned copies alone', () => {
    const single = [tab(url, { id: 1, lastAccessed: NOW - 10 * DAY })];
    expect(duplicateIdsToClose(single, single)).toEqual([]);

    const pinned = [
      tab(url, { id: 1, pinned: true, lastAccessed: NOW - 10 * DAY }),
      tab(url, { id: 2, lastAccessed: NOW - 10 * DAY }),
    ];
    const matches = tabsMatchingRule({ ...rule, excludePinned: false }, pinned, NOW);
    expect(duplicateIdsToClose(matches, pinned)).toEqual([2]);
  });
});

describe('tab health', () => {
  it('canonicalizes common tracking parameters without changing useful parameters', () => {
    expect(canonicalUrl('https://example.com/page?id=4&utm_source=news#top')).toBe(
      'https://example.com/page?id=4',
    );
  });

  it('finds canonical duplicates, tracking URLs, stale tabs, and discard candidates', () => {
    const tabs = [
      tab('https://example.com/page?id=4&utm_source=news', { lastAccessed: NOW - 31 * DAY }),
      tab('https://example.com/page?id=4', { active: true }),
      tab('https://other.com', { pinned: true, lastAccessed: NOW - 40 * DAY }),
    ];
    const health = analyzeTabHealth(tabs, NOW);
    expect(health.duplicates).toHaveLength(2);
    expect(health.tracking).toHaveLength(1);
    expect(health.stale).toHaveLength(1);
    expect(health.discardable).toHaveLength(1);
  });
});
