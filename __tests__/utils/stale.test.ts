import { describe, expect, it } from 'vitest';
import { isStale, shortAge, staleTabs } from '../../utils/stale';
import { toStashedTabs } from '../../utils/sessions';
import type { TabInfo } from '../../utils/types';

const NOW = new Date('2026-06-29T12:00:00Z').getTime();
const DAY = 86_400_000;

function tab(over: Partial<TabInfo> = {}): TabInfo {
  return { url: 'https://a.com', title: 'A', active: false, isTabOut: false, ...over };
}

describe('isStale', () => {
  it('flags inactive tabs untouched 7+ days', () => {
    expect(isStale(tab({ lastAccessed: NOW - 8 * DAY }), NOW)).toBe(true);
    expect(isStale(tab({ lastAccessed: NOW - 2 * DAY }), NOW)).toBe(false);
  });

  it('never flags the active tab', () => {
    expect(isStale(tab({ active: true, lastAccessed: NOW - 30 * DAY }), NOW)).toBe(false);
  });

  it('ignores tabs without lastAccessed', () => {
    expect(isStale(tab({ lastAccessed: undefined }), NOW)).toBe(false);
  });
});

describe('staleTabs', () => {
  it('returns stale tabs oldest-first', () => {
    const tabs = [
      tab({ url: 'https://new.com', lastAccessed: NOW - DAY }),
      tab({ url: 'https://old.com', lastAccessed: NOW - 30 * DAY }),
      tab({ url: 'https://mid.com', lastAccessed: NOW - 10 * DAY }),
    ];
    expect(staleTabs(tabs, NOW).map((t) => t.url)).toEqual(['https://old.com', 'https://mid.com']);
  });
});

describe('shortAge', () => {
  it('formats compactly', () => {
    expect(shortAge(NOW - 3 * DAY, NOW)).toBe('3d');
    expect(shortAge(NOW - 5 * 3_600_000, NOW)).toBe('5h');
    expect(shortAge(NOW - 2 * 60_000, NOW)).toBe('2m');
    expect(shortAge(undefined, NOW)).toBe('');
  });
});

describe('toStashedTabs', () => {
  it('keeps url+title and drops internal pages', () => {
    const out = toStashedTabs([
      { url: 'https://a.com', title: 'A' },
      { url: 'chrome://settings', title: 'Settings' },
      { url: 'https://b.com', title: '' },
    ]);
    expect(out).toEqual([
      { url: 'https://a.com', title: 'A' },
      { url: 'https://b.com', title: 'https://b.com' },
    ]);
  });
});
