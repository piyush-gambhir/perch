import { describe, expect, it } from 'vitest';
import { safeHref, timeAgo } from '../../utils/format';
import { isStale } from '../../utils/stale';
import { uid } from '../../utils/id';
import { withLock } from '../../utils/locks';
import { reorderById } from '../../utils/dnd';
import type { TabInfo } from '../../utils/types';

describe('timeAgo invalid input', () => {
  it('returns empty string for unparseable dates', () => {
    expect(timeAgo('not-a-date')).toBe('');
    expect(timeAgo('')).toBe('');
  });
});

describe('safeHref', () => {
  it('allows http/https/file', () => {
    expect(safeHref('https://a.com/x')).toBe('https://a.com/x');
    expect(safeHref('http://a.com')).toBe('http://a.com');
    expect(safeHref('file:///Users/me/x.html')).toBe('file:///Users/me/x.html');
  });
  it('blocks javascript: and data: and junk', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('data:text/html,<script>')).toBe('#');
    expect(safeHref('not a url')).toBe('#');
  });
});

describe('isStale ignores suspended tabs', () => {
  const NOW = new Date('2026-06-29T12:00:00Z').getTime();
  const base: TabInfo = { url: 'https://a.com', title: 'A', active: false, isPerchTab: false };
  it('does not flag a discarded tab even if old', () => {
    expect(isStale({ ...base, lastAccessed: NOW - 30 * 86_400_000, discarded: true }, NOW)).toBe(
      false,
    );
    expect(isStale({ ...base, lastAccessed: NOW - 30 * 86_400_000, discarded: false }, NOW)).toBe(
      true,
    );
  });
});

describe('uid', () => {
  it('produces unique ids in a tight loop', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uid()));
    expect(ids.size).toBe(2000);
  });
});

describe('withLock', () => {
  it('serializes critical sections by name', async () => {
    const order: string[] = [];
    const slow = (tag: string, ms: number) =>
      withLock('t', async () => {
        order.push(`${tag}:start`);
        await new Promise((r) => setTimeout(r, ms));
        order.push(`${tag}:end`);
      });
    await Promise.all([slow('a', 20), slow('b', 1)]);
    // b must not start until a finishes (no interleaving).
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('runs different lock names concurrently', async () => {
    const order: string[] = [];
    await Promise.all([
      withLock('x', async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push('x');
      }),
      withLock('y', async () => {
        order.push('y');
      }),
    ]);
    expect(order).toEqual(['y', 'x']);
  });
});

describe('reorderById (regression)', () => {
  it('still moves items', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reorderById(items, 'c', 'a', (x) => x.id).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
