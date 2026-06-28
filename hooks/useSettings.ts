/**
 * useSettings — loads settings from storage.sync, applies the theme to the document,
 * and persists updates.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  onSettingsChanged,
  saveSettings,
  type Settings,
} from '../utils/settings';

export interface UseSettings {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const refresh = useCallback(async () => {
    setSettings(await getSettings());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onSettingsChanged(refresh);
    return unsub;
  }, [refresh]);

  // Apply the theme to the page whenever it changes.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await saveSettings(patch));
  }, []);

  return { settings, update };
}
