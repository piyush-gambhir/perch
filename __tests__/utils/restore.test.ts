import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, resetFakeBrowser } from '../fakeBrowser';
import {
  getRecentlyClosed,
  getSessions,
  pushClosed,
  restoreClosed,
  restoreSession,
  saveSession,
  undoLastClose,
} from '../../utils/sessions';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

const A = { url: 'https://a.test/', title: 'A' };
const B = { url: 'https://b.test/', title: 'B' };

const openUrls = () => fake.tabs.map((tab) => tab.url);

beforeEach(() => resetFakeBrowser());

describe('restoreSession keeps tabs that failed to open', () => {
  it('removes only the opened tabs from the stash', async () => {
    const session = await saveSession('Mixed', [A, B]);
    fake.failUrls.add(B.url);

    expect(await restoreSession(session!.id, { remove: true })).toEqual({ opened: 1, failed: 1 });
    expect(openUrls()).toEqual([A.url]);
    const [left] = await getSessions();
    expect(left.id).toBe(session!.id);
    expect(left.tabs).toEqual([B]);
  });

  it('removes the stash once everything opened', async () => {
    const session = await saveSession('All good', [A, B]);
    expect(await restoreSession(session!.id, { remove: true })).toEqual({ opened: 2, failed: 0 });
    expect(await getSessions()).toEqual([]);
  });

  it('keeps an unopenable first tab when restoring into a new window', async () => {
    const session = await saveSession('New window', [A, B]);
    fake.failUrls.add(A.url);

    const result = await restoreSession(session!.id, { remove: true, newWindow: true });
    expect(result).toEqual({ opened: 1, failed: 1 });
    expect((await getSessions())[0].tabs).toEqual([A]);
  });
});

describe('restoreClosed (undo) keeps its record until the tabs open', () => {
  it('keeps only the failed tabs in the record', async () => {
    await pushClosed('Two tabs', [A, B]);
    fake.failUrls.add(A.url);

    expect(await undoLastClose()).toEqual({ opened: 1, failed: 1 });
    const [record] = await getRecentlyClosed();
    expect(record.tabs).toEqual([A]);

    // A retry once the URL can open drains the record.
    fake.failUrls.clear();
    expect(await restoreClosed(record.id)).toEqual({ opened: 1, failed: 0 });
    expect(await getRecentlyClosed()).toEqual([]);
  });

  it('keeps the whole record when nothing opened', async () => {
    await pushClosed('Gone window', [A]);
    fake.failUrls.add(A.url);
    expect(await undoLastClose()).toEqual({ opened: 0, failed: 1 });
    expect((await getRecentlyClosed())[0].tabs).toEqual([A]);
  });

  it('serializes concurrent undos so tabs reopen once', async () => {
    await pushClosed('Double click', [A, B]);
    const [record] = await getRecentlyClosed();
    const results = await Promise.all([restoreClosed(record.id), restoreClosed(record.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(openUrls()).toEqual([A.url, B.url]);
    expect(await getRecentlyClosed()).toEqual([]);
  });

  it('reports nothing to undo for an empty stack', async () => {
    expect(await undoLastClose()).toBeNull();
  });
});
