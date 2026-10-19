import { describe, expect, it, vi } from 'vitest';
import { closableTabs, toStashedTabs } from '../../utils/sessions';
import type { TabInfo } from '../../utils/types';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

const tab = (url: string, patch: Partial<TabInfo> = {}): TabInfo => ({
  url,
  title: url,
  active: false,
  isPerchTab: false,
  ...patch,
});

describe('closableTabs', () => {
  it('never offers internal, empty, or Perch pages for closing', () => {
    const tabs = [
      tab('chrome://settings/'),
      tab('chrome-extension://perch/newtab.html', { isPerchTab: true }),
      tab('about:blank'),
      tab(''),
    ];
    expect(closableTabs(tabs)).toEqual([]);
  });

  it('keeps pinned tabs open', () => {
    const pinned = tab('https://mail.test/', { pinned: true });
    const plain = tab('https://docs.test/');
    expect(closableTabs([pinned, plain])).toEqual([plain]);
  });

  it('closes exactly the tabs a stash saves', () => {
    const tabs = [
      tab('https://a.test/'),
      tab('chrome://settings/'),
      tab('https://b.test/', { pinned: true }),
      tab('https://c.test/'),
    ];
    const closable = closableTabs(tabs);
    expect(toStashedTabs(closable).map((t) => t.url)).toEqual(closable.map((t) => t.url));
    expect(closable.map((t) => t.url)).toEqual(['https://a.test/', 'https://c.test/']);
  });
});
