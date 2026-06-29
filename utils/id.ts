/**
 * Collision-free id generator. crypto.randomUUID() when available; otherwise a
 * monotonic counter combined with the timestamp so ids never collide even when many
 * are created within the same millisecond (e.g. bulk "save for later").
 */

let counter = 0;

export function uid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
