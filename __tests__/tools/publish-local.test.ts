// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repo, 'tools/publish-local.mjs');
const temps: string[] = [];

/** Run the script with this shelf (and HOME). Refusals must happen before any write. */
function publish(shelf: string, home?: string) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, CHROME_EXTENSIONS_DIR: shelf, ...(home ? { HOME: home } : {}) },
  });
}

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perch-publish-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('publish-local destination guard', () => {
  it('refuses a destination inside the repository', () => {
    const result = publish(repo);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to replace');
    expect(existsSync(join(repo, 'perch'))).toBe(false);
  });

  it('refuses a destination that resolves to the repository through a symlink', () => {
    const shelf = tempDir();
    symlinkSync(repo, join(shelf, 'perch'));
    const result = publish(shelf);
    expect(result.status).toBe(1);
    expect(existsSync(join(repo, 'package.json'))).toBe(true);
  });

  it('refuses the home directory and leaves it untouched', () => {
    const shelf = tempDir();
    const home = join(shelf, 'perch');
    mkdirSync(home);
    writeFileSync(join(home, 'keep.txt'), 'mine');
    const result = publish(shelf, home);
    expect(result.status).toBe(1);
    expect(readdirSync(home)).toEqual(['keep.txt']);
  });
});
