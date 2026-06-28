import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../../utils/settings';

describe('mergeSettings', () => {
  it('returns defaults for empty/invalid input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and falls back on invalid ones', () => {
    expect(
      mergeSettings({ sound: false, theme: 'dark', density: 'compact', staleDays: 14 }),
    ).toEqual({ sound: false, confetti: true, theme: 'dark', density: 'compact', staleDays: 14 });
  });

  it('rejects bad theme/density values', () => {
    const s = mergeSettings({ theme: 'neon', density: 'roomy' });
    expect(s.theme).toBe('auto');
    expect(s.density).toBe('comfortable');
  });

  it('clamps stale threshold to 1–90 and rounds', () => {
    expect(mergeSettings({ staleDays: 0 }).staleDays).toBe(7);
    expect(mergeSettings({ staleDays: 200 }).staleDays).toBe(7);
    expect(mergeSettings({ staleDays: 3.7 }).staleDays).toBe(4);
  });
});
