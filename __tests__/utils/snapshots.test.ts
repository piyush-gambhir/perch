import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, openTabs, resetFakeBrowser } from '../fakeBrowser';
import {
  captureSnapshot,
  deleteSnapshot,
  getSnapshots,
  restoreSnapshot,
} from '../../utils/snapshots';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

beforeEach(() => {
  resetFakeBrowser();
  openTabs({ url: 'https://a.test/' });
});

describe('snapshot mutations are serialized', () => {
  it('keeps both of two concurrent captures', async () => {
    const [first, second] = await Promise.all([
      captureSnapshot('manual', true),
      captureSnapshot('before-switch', true),
    ]);
    const ids = (await getSnapshots()).map((snapshot) => snapshot.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([first!.id, second!.id]));
  });

  it('neither resurrects a deleted snapshot nor loses a concurrent capture', async () => {
    const old = await captureSnapshot('manual', true);
    const [, fresh] = await Promise.all([deleteSnapshot(old!.id), captureSnapshot('manual', true)]);
    expect((await getSnapshots()).map((snapshot) => snapshot.id)).toEqual([fresh!.id]);
  });
});

describe('restoreSnapshot', () => {
  it('reopens missing tabs with their captured pinned state', async () => {
    openTabs({ url: 'https://pinned.test/', pinned: true });
    const snapshot = await captureSnapshot('manual', true);
    fake.tabs = [];

    expect(await restoreSnapshot(snapshot!.id)).toBe(2);
    expect(fake.tabs.map(({ url, pinned }) => ({ url, pinned }))).toEqual([
      { url: 'https://a.test/', pinned: false },
      { url: 'https://pinned.test/', pinned: true },
    ]);
  });

  it('counts only the tabs that actually opened', async () => {
    const snapshot = await captureSnapshot('manual', true);
    fake.tabs = [];
    fake.failUrls.add('https://a.test/');
    expect(await restoreSnapshot(snapshot!.id)).toBe(0);
  });
});
