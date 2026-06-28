/**
 * User settings, persisted in browser.storage.sync so they follow the user across
 * devices (they're tiny — well within sync quota). No login required.
 */

import { browser } from 'wxt/browser';

export type Theme = 'auto' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export interface Settings {
  sound: boolean;
  confetti: boolean;
  theme: Theme;
  density: Density;
  staleDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  confetti: true,
  theme: 'auto',
  density: 'comfortable',
  staleDays: 7,
};

const KEY = 'settings';

/** Pure merge of stored values onto defaults, clamping/validating each field. */
export function mergeSettings(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>;
  const theme: Theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto';
  const density: Density = s.density === 'compact' ? 'compact' : 'comfortable';
  const staleDays =
    typeof s.staleDays === 'number' && s.staleDays >= 1 && s.staleDays <= 90
      ? Math.round(s.staleDays)
      : DEFAULT_SETTINGS.staleDays;
  return {
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    confetti: typeof s.confetti === 'boolean' ? s.confetti : DEFAULT_SETTINGS.confetti,
    theme,
    density,
    staleDays,
  };
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
