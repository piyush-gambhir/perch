import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFakeBrowser } from '../fakeBrowser';
import { checkOffSavedTab, getSavedTabs, saveTabForLater } from '../../utils/storage';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

beforeEach(() => resetFakeBrowser());

describe('saved-for-later archive', () => {
  it('never deletes older archived items when more are checked off', async () => {
    const total = 205;
    for (let i = 0; i < total; i++) {
      await saveTabForLater({ url: `https://a.test/${i}`, title: `Tab ${i}` });
    }
    for (const item of (await getSavedTabs()).active) await checkOffSavedTab(item.id);

    const { active, archived } = await getSavedTabs();
    expect(active).toHaveLength(0);
    expect(archived).toHaveLength(total);
    expect(archived.map((item) => item.url)).toContain('https://a.test/0');
  });
});
