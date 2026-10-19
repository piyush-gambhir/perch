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

describe('closeDuplicateTabs', () => {
  it('returns exactly the copies it closed, for undo, and keeps pinned copies', async () => {
    const { resetFakeBrowser, openTabs, fake } = await import('../fakeBrowser');
    const { closeDuplicateTabs } = await import('../../utils/tabs');
    resetFakeBrowser();
    openTabs(
      { url: 'https://a.test/', title: 'A1', active: true },
      { url: 'https://a.test/', title: 'A2' },
      { url: 'https://a.test/', title: 'A3', pinned: true },
      { url: 'https://b.test/', title: 'B' },
    );
    const closed = await closeDuplicateTabs(['https://a.test/', 'https://b.test/']);
    // The pinned copy is the one kept, and pinned tabs are never closed.
    expect(closed.map((t) => t.title).sort()).toEqual(['A1', 'A2']);
    expect(fake.tabs.map((t) => t.title).sort()).toEqual(['A3', 'B']);
  });
});
