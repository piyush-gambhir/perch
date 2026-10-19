import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake, openTabs, resetFakeBrowser } from '../fakeBrowser';
import {
  createWorkspace,
  getWorkspaces,
  setActiveWorkspaceId,
  switchWorkspace,
} from '../../utils/workspaces';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

beforeEach(() => resetFakeBrowser());

const tabsOf = async (id: string) => (await getWorkspaces()).find((w) => w.id === id)?.tabs;

describe('switchWorkspace', () => {
  it('saves an emptied workspace so its old tabs do not come back', async () => {
    const a = await createWorkspace('A', [{ url: 'https://old.test/', title: 'Old' }]);
    const b = await createWorkspace('B');
    await setActiveWorkspaceId(a.id);

    // Every tab of A was closed before switching away.
    await switchWorkspace(b.id);
    expect(await tabsOf(a.id)).toEqual([]);

    await switchWorkspace(a.id);
    expect(fake.tabs.map((tab) => tab.url)).not.toContain('https://old.test/');
  });

  it('keeps tabs that failed to open when switching away again', async () => {
    const a = await createWorkspace('A');
    const b = await createWorkspace('B', [
      { url: 'https://good.test/', title: 'Good' },
      { url: 'https://bad.test/', title: 'Bad' },
    ]);
    await setActiveWorkspaceId(a.id);
    fake.failUrls.add('https://bad.test/');

    await switchWorkspace(b.id);
    expect(fake.tabs.map((tab) => tab.url)).toEqual(['https://good.test/']);
    await switchWorkspace(a.id);
    expect((await tabsOf(b.id))?.map((tab) => tab.url)).toEqual([
      'https://good.test/',
      'https://bad.test/',
    ]);
  });

  it('keeps a workspace whose tabs all failed to open', async () => {
    const a = await createWorkspace('A');
    const b = await createWorkspace('B', [{ url: 'https://bad.test/', title: 'Bad' }]);
    await setActiveWorkspaceId(a.id);
    fake.failUrls.add('https://bad.test/');

    await switchWorkspace(b.id);
    await switchWorkspace(a.id);
    expect(await tabsOf(b.id)).toEqual([{ url: 'https://bad.test/', title: 'Bad' }]);
  });

  it('does not create an empty recovery workspace when nothing was open', async () => {
    const b = await createWorkspace('B');
    await setActiveWorkspaceId('deleted-elsewhere');
    await switchWorkspace(b.id);
    expect((await getWorkspaces()).map((w) => w.name)).toEqual(['B']);
  });

  it('keeps pinned tabs open and out of the capture', async () => {
    const a = await createWorkspace('A');
    const b = await createWorkspace('B');
    await setActiveWorkspaceId(a.id);
    openTabs({ url: 'https://mail.test/', title: 'Mail', pinned: true });
    openTabs({ url: 'https://doc.test/', title: 'Doc' });

    await switchWorkspace(b.id);
    expect(await tabsOf(a.id)).toEqual([{ url: 'https://doc.test/', title: 'Doc' }]);
    expect(fake.tabs.map((tab) => tab.url)).toEqual(['https://mail.test/']);
  });

  it('still captures open tabs into the active workspace', async () => {
    const a = await createWorkspace('A');
    const b = await createWorkspace('B');
    await setActiveWorkspaceId(a.id);
    openTabs({ url: 'https://a.test/', title: 'A' });
    await switchWorkspace(b.id);
    expect(await tabsOf(a.id)).toEqual([{ url: 'https://a.test/', title: 'A' }]);
  });
});
