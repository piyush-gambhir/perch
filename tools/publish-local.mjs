import { cp, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';





const repo = fileURLToPath(new URL('..', import.meta.url));
const source = join(repo, '.output/chrome-mv3');
const shelf = process.env.CHROME_EXTENSIONS_DIR || join(homedir(), 'chrome-extensions');
const target = resolve(shelf, 'perch');


async function realish(p) {
  const rest = [];
  let cur = resolve(p);
  for (;;) {
    try {
      return join(await realpath(cur), ...rest.reverse());
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return resolve(p);
      rest.push(basename(cur));
      cur = parent;
    }
  }
}


function isWithin(child, parent) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

const [dest, repoReal, homeReal] = await Promise.all([
  realish(target),
  realish(repo),
  realish(homedir()),
]);
const refusal =
  dest === parse(dest).root
    ? 'a filesystem root'
    : isWithin(homeReal, dest)
      ? 'the home directory or a folder containing it'
      : isWithin(dest, repoReal) || isWithin(repoReal, dest)
        ? 'the repository, a folder inside it, or a folder containing it'
        : null;
if (refusal) {
  console.error(
    `Refusing to replace ${dest}: it is ${refusal}. Set CHROME_EXTENSIONS_DIR elsewhere.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
const exists = (p) =>
  lstat(p).then(
    () => true,
    () => false,
  );


const staging = `${target}.staging-${process.pid}`;
const previous = `${target}.previous-${process.pid}`;
await mkdir(shelf, { recursive: true });
try {
  await cp(source, staging, { recursive: true });
  await writeFile(
    join(staging, 'local-build.json'),
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
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}


const hadPrevious = await exists(target);
if (hadPrevious) await rename(target, previous);
try {
  await rename(staging, target);
} catch (error) {
  if (hadPrevious) await rename(previous, target);
  await rm(staging, { recursive: true, force: true });
  throw error;
}
if (hadPrevious) await rm(previous, { recursive: true, force: true });

console.log(`Published unpacked extension to ${target}`);
