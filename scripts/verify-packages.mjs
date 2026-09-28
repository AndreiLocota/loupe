import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const archives = JSON.parse(await readFile(join(root, 'artifacts', 'packages.json'), 'utf8'));
assert.equal(archives.length, 5, 'Build all five packages before verification');
const consumer = await mkdtemp(join(tmpdir(), 'loupe-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

try {
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'loupe-consumer-check', private: true, type: 'module' }));
  await writeFile(join(consumer, '.npmrc'), 'registry=https://registry.npmjs.org/\n');
  execFileSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--userconfig', join(consumer, '.npmrc'), ...archives.map(item => join(root, 'artifacts', item.file))], {
    cwd: consumer, stdio: 'inherit',
  });
  for (const archive of archives) {
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules', archive.name, 'package.json'), 'utf8'));
    assert.equal(installed.version, archive.version);
    await readFile(join(consumer, 'node_modules', archive.name, 'dist', 'index.js'));
    await readFile(join(consumer, 'node_modules', archive.name, 'dist', 'index.d.ts'));
  }
  for (const asset of [
    '@veridox-ai/loupe-pdf/dist/workers/pdf.worker.js',
    '@veridox-ai/loupe-image/dist/workers/tiff.worker.js',
    '@silurus/ooxml/dist/docx_parser_bg.wasm',
  ]) await readFile(join(consumer, 'node_modules', asset));

  await writeFile(join(consumer, 'smoke.ts'), `
import { ViewerStore } from '@veridox-ai/loupe-core';
import { createPdfAdapterFactory } from '@veridox-ai/loupe-pdf';
import { createDocxAdapterFactory } from '@veridox-ai/loupe-docx';
import { createImageAdapterFactory } from '@veridox-ai/loupe-image';
import { ViewerProvider, ViewerSurface } from '@veridox-ai/loupe-react';
const store = new ViewerStore();
store.registerFactory(createPdfAdapterFactory());
store.registerFactory(createDocxAdapterFactory());
store.registerFactory(createImageAdapterFactory());
console.log(store, ViewerProvider, ViewerSurface);
`);
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--skipLibCheck', '--strict', '--module', 'ESNext', '--moduleResolution', 'bundler', '--target', 'ES2022', '--lib', 'ES2022,DOM,DOM.Iterable', 'smoke.ts'], {
    cwd: consumer, stdio: 'inherit',
  });
  execFileSync(process.execPath, ['--input-type=module', '-e', "import { ViewerStore } from '@veridox-ai/loupe-core'; const store = new ViewerStore(); if (!store) throw Error('Missing store'); console.log('Core imported from installed archive');"], {
    cwd: consumer, stdio: 'inherit',
  });
  console.log('All five archives install without workspace links; types and runtime assets verified.');
} finally {
  await rm(consumer, { recursive: true, force: true });
}
