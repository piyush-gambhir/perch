import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = join(__dirname, '..', 'public', 'icon');
const SOURCE_SVG = join(ICON_DIR, 'icon.svg');
const requireFrom = createRequire(import.meta.url);

let sharp = null;
try {
  sharp = requireFrom('sharp');
} catch {
  console.error('sharp not found. Run pnpm install first.');
  process.exit(1);
}

if (!existsSync(SOURCE_SVG)) {
  console.error(`Source icon not found: ${SOURCE_SVG}`);
  process.exit(1);
}

const svgBuffer = readFileSync(SOURCE_SVG);
const sizes = [16, 32, 48, 96, 128];

for (const size of sizes) {
  const outputPath = join(ICON_DIR, `${size}.png`);
  await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
  console.log(`✓ Generated ${size}x${size} icon`);
}

console.log('All extension icons generated successfully.');
