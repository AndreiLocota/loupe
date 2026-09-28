import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(root, 'artifacts');
await mkdir(destination, { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packages = ['core', 'docx', 'pdf', 'image', 'react'];
const manifest = [];

for (const kind of packages) {
  const directory = join(root, 'packages', `viewer-${kind}`);
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  // Fail early if build output is absent; never emit source-only broken packages.
  await readFile(join(directory, 'dist', 'index.js'));
  const result = JSON.parse(execFileSync(npm, ['pack', '--json', '--pack-destination', destination], {
    cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }));
  const archive = result[0];
  for (const expected of ['dist/index.js', 'dist/index.d.ts', 'LICENSE']) {
    if (!archive.files.some(file => file.path === expected)) {
      throw new Error(`${metadata.name}: package is missing ${expected}`);
    }
  }
  manifest.push({ name: metadata.name, version: metadata.version, file: archive.filename, integrity: archive.integrity });
  console.log(`${metadata.name}@${metadata.version} → artifacts/${archive.filename}`);
}
await writeFile(join(destination, 'packages.json'), JSON.stringify(manifest, null, 2) + '\n');
