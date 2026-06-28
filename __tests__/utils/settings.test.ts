import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../../utils/settings';

describe('mergeSettings', () => {
  it('returns defaults for empty/invalid input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields', () => {
    expect(mergeSettings({ theme: 'dark', staleDays: 14, autoStash: true })).toEqual({
      theme: 'dark',
      staleDays: 14,
      autoStash: true,
    });
  });

  it('rejects bad theme values', () => {
    expect(mergeSettings({ theme: 'neon' }).theme).toBe('auto');
  });

  it('clamps stale threshold to 1–90 and rounds', () => {
    expect(mergeSettings({ staleDays: 0 }).staleDays).toBe(7);
    expect(mergeSettings({ staleDays: 200 }).staleDays).toBe(7);
    expect(mergeSettings({ staleDays: 3.7 }).staleDays).toBe(4);
  });
});
