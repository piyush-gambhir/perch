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

  // storage.sync's 8KB/item quota is measured on the JSON-escaped UTF-8 bytes, so
  // multi-byte chars and escapes must count at their stored size, not their length.
  const escapedBytes = (s: string) => new TextEncoder().encode(JSON.stringify(s)).length - 2;

  it('counts multi-byte characters at their UTF-8 size', () => {
    const cjk = '日本語のタブ'.repeat(100); // 3 bytes/char
    const chunks = chunkString(cjk, 100);
    for (const c of chunks) expect(escapedBytes(c)).toBeLessThanOrEqual(100);
    expect(joinChunks(chunks)).toBe(cjk);
  });

  it('counts JSON escapes (quotes, backslashes) double', () => {
    const quoty = '"\\'.repeat(300);
    const chunks = chunkString(quoty, 64);
    for (const c of chunks) expect(escapedBytes(c)).toBeLessThanOrEqual(64);
    expect(joinChunks(chunks)).toBe(quoty);
  });

  it('never splits a surrogate pair', () => {
    const emoji = '😀😀😀😀😀'; // each is a 2-unit surrogate pair, 4 UTF-8 bytes
    const chunks = chunkString(emoji, 5); // forces a boundary mid-run
    for (const c of chunks) expect(c).toBe(joinChunks([...c])); // valid slices
    expect(joinChunks(chunks)).toBe(emoji);
    for (const c of chunks) expect(JSON.parse(JSON.stringify(c))).toBe(c); // round-trips JSON
  });
});
