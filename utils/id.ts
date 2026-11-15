





let counter = 0;

export function uid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
