import { describe, expect, it } from 'vitest';
import { reorderById } from '../../utils/dnd';
import { chunkString, joinChunks } from '../../utils/syncedStore';

describe('reorderById', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const idOf = (x: { id: string }) => x.id;

  it('moves an item to the target position', () => {
    expect(reorderById(items, 'c', 'a', idOf).map(idOf)).toEqual(['c', 'a', 'b']);
    expect(reorderById(items, 'a', 'c', idOf).map(idOf)).toEqual(['b', 'c', 'a']);
  });

  it('returns the same array on no-op / unknown ids', () => {
    expect(reorderById(items, 'a', 'a', idOf)).toBe(items);
    expect(reorderById(items, 'z', 'a', idOf)).toBe(items);
  });
});

describe('chunkString / joinChunks', () => {
  it('splits to the given size', () => {
    expect(chunkString('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('handles empty input', () => {
    expect(chunkString('')).toEqual([]);
    expect(joinChunks([])).toBe('');
  });

  it('round-trips a large string', () => {
    const s = 'x'.repeat(20000);
    expect(joinChunks(chunkString(s, 6000))).toBe(s);
  });

  it('round-trips JSON data across chunks', () => {
    const data = [
      { url: 'https://a.com', title: 'A' },
      { url: 'https://b.com', title: 'B' },
    ];
    expect(JSON.parse(joinChunks(chunkString(JSON.stringify(data), 7)))).toEqual(data);
  });
});
