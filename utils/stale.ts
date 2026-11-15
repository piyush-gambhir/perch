




import type { TabInfo } from './types';

export const STALE_DAYS = 7;


export function isStale(t: TabInfo, now: number = Date.now(), days: number = STALE_DAYS): boolean {
  if (t.active) return false;
  if (t.discarded) return false;
  if (t.pinned) return false;
  if (!t.lastAccessed) return false;
  return now - t.lastAccessed > days * 86_400_000;
}


export function staleTabs(
  tabs: TabInfo[],
  now: number = Date.now(),
  days: number = STALE_DAYS,
): TabInfo[] {
  return tabs
    .filter((t) => isStale(t, now, days))
    .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));
}


export function shortAge(ms?: number, now: number = Date.now()): string {
  if (!ms) return '';
  const days = Math.floor((now - ms) / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor((now - ms) / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor((now - ms) / 60_000);
  return mins >= 1 ? `${mins}m` : 'now';
}
