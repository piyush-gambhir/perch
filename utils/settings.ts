/**
 * User settings, persisted in browser.storage.sync so they follow the user across
 * devices (they're tiny — well within sync quota). No login required.
 */

import { browser } from 'wxt/browser';

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  staleDays: number;
  /** Auto-stash stale tabs on a recurring background schedule. */
  autoStash: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  staleDays: 7,
  autoStash: false,
};

const KEY = 'settings';

/** Pure merge of stored values onto defaults, clamping/validating each field. */
export function mergeSettings(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>;
  const theme: Theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto';
  const staleDays =
    typeof s.staleDays === 'number' && s.staleDays >= 1 && s.staleDays <= 90
      ? Math.round(s.staleDays)
      : DEFAULT_SETTINGS.staleDays;
  const autoStash = typeof s.autoStash === 'boolean' ? s.autoStash : false;
  return { theme, staleDays, autoStash };
}

export async function getSettings(): Promise<Settings> {
  try {
    const result = (await browser.storage.sync.get(KEY)) as { settings?: unknown };
    return mergeSettings(result.settings);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = mergeSettings({ ...(await getSettings()), ...patch });
  await browser.storage.sync.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'sync' && KEY in changes) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
