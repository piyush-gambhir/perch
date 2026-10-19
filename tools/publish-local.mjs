import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const source = resolve('.output/chrome-mv3');
const shelf = process.env.CHROME_EXTENSIONS_DIR || join(homedir(), 'chrome-extensions');
const target = join(shelf, 'perch');
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));

await mkdir(shelf, { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
await writeFile(
  join(target, 'local-build.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      builtAt: new Date().toISOString(),
      source,
    },
    null,
    2,
  )}\n`,
);

console.log(`Published unpacked extension to ${target}`);
