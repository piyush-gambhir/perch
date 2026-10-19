/**
 * User settings, persisted in browser.storage.sync so they follow the user across
 * devices, with a local fallback if sync is temporarily unavailable.
 */

import { browser } from 'wxt/browser';
import { withLock } from './locks';

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
const REV_KEY = 'settings__rev';

type StoredSettings = { settings?: unknown; settings__rev?: unknown };

function revision(stored: StoredSettings | undefined): number {
  return typeof stored?.[REV_KEY] === 'number' ? stored[REV_KEY] : 0;
}

/** Pure merge of stored values onto defaults, clamping/validating each field. */
export function mergeSettings(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>;
  const theme: Theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto';
  const staleDays =
    typeof s.staleDays === 'number' && s.staleDays >= 1 && s.staleDays <= 30
      ? Math.round(s.staleDays)
      : DEFAULT_SETTINGS.staleDays;
  const autoStash = typeof s.autoStash === 'boolean' ? s.autoStash : false;
  return { theme, staleDays, autoStash };
}

export async function getSettings(): Promise<Settings> {
  const [syncResult, localResult] = await Promise.allSettled([
    browser.storage.sync.get([KEY, REV_KEY]) as Promise<StoredSettings>,
    browser.storage.local.get([KEY, REV_KEY]) as Promise<StoredSettings>,
  ]);
  const sync = syncResult.status === 'fulfilled' ? syncResult.value : undefined;
  const local = localResult.status === 'fulfilled' ? localResult.value : undefined;
  // Legacy unrevisioned sync data still wins when no local copy exists. Once either
  // side has a revision, the newest successful write wins.
  const winner =
    sync?.settings !== undefined &&
    (local?.settings === undefined || revision(sync) >= revision(local))
      ? sync
      : local;
  return mergeSettings(winner?.settings);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return withLock(`perch-store:${KEY}`, async () => {
    const next = mergeSettings({ ...(await getSettings()), ...patch });
    const local = (await browser.storage.local.get(REV_KEY)) as StoredSettings;
    const sync = await browser.storage.sync.get(REV_KEY).catch(() => ({}) as StoredSettings);
    const rev = Math.max(Date.now(), revision(local) + 1, revision(sync) + 1);
    await browser.storage.local.set({ [KEY]: next, [REV_KEY]: rev });
    try {
      await browser.storage.sync.set({ [KEY]: next, [REV_KEY]: rev });
    } catch {
      /* storage.local is the required fallback when sync is unavailable. */
    }
    return next;
  });
}

export function onSettingsChanged(cb: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if ((area === 'sync' || area === 'local') && KEY in changes) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
