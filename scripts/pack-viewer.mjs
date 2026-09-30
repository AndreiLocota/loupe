import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMapPolyfills } from '../distribution/pdf-compat.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'artifacts');
const stage = join(out, 'viewer-package');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const kinds = ['core', 'docx', 'pdf', 'image', 'react'];
const dependencies = {};
const exports = {};
for (const kind of kinds) {
  const source = join(root, 'packages', `viewer-${kind}`);
  const metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  Object.assign(dependencies, metadata.dependencies ?? {});
  await readFile(join(source, 'dist/index.js')); // Require a completed build.
  await cp(join(source, 'dist'), join(stage, 'dist', kind), { recursive: true });
  exports[kind === 'core' ? '.' : `./${kind}`] = {
    types: `./dist/${kind}/index.d.ts`, import: `./dist/${kind}/index.js`,
  };
}
// Preserve one shared core across all adapters and React, including type identity.
async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await rewrite(path);
    else if (entry.name.endsWith('.map')) await rm(path);
    else if (/\.(js|ts)$/.test(entry.name)) {
      const text = await readFile(path, 'utf8');
      await writeFile(path, text.replaceAll('@veridox-ai/loupe-core', '../core/index.js').replace(/^\/\/# sourceMappingURL=.*$/gm, ''));
    }
  }
}
await rewrite(join(stage, 'dist'));
const shim = installMapPolyfills.toString();
await writeFile(join(stage, 'dist/pdf-entry.js'), `import { createPdfAdapterFactory as createFactory } from './pdf/index.js';
export * from './pdf/index.js';
${shim}
export function createPdfAdapterFactory(workerSrc) {
  installMapPolyfills();
  return createFactory(workerSrc);
}
`);
exports['./pdf'].import = './dist/pdf-entry.js';
const workerPath = join(stage, 'dist/pdf/workers/pdf.worker.js');
await writeFile(workerPath, `(${shim})();\n` + await readFile(workerPath, 'utf8'));
await cp(join(root, 'distribution/LICENSE'), join(stage, 'LICENSE'));
await cp(join(root, 'distribution/README.md'), join(stage, 'README.md'));
await cp(join(root, 'distribution/copy-assets.mjs'), join(stage, 'copy-assets.mjs'));
await writeFile(join(stage, 'package.json'), JSON.stringify({
  name: '@andreilocota/loupe', version: '0.1.2', type: 'module',
  description: 'Loupe document viewer: PDF, Word, images and optional React bindings in one package.',
  license: 'SEE LICENSE IN LICENSE', author: 'Veridox',
  repository: { type: 'git', url: 'git+https://github.com/AndreiLocota/loupe.git' },
  exports, main: './dist/core/index.js', types: './dist/core/index.d.ts',
  files: ['dist', 'copy-assets.mjs', 'THIRD-PARTY-LICENSES'], bin: { 'loupe-assets': './copy-assets.mjs' },
  sideEffects: false, dependencies,
  peerDependencies: { react: '>=18', 'react-dom': '>=18' },
  peerDependenciesMeta: { react: { optional: true }, 'react-dom': { optional: true } },
  engines: { node: '>=22.13.0' },
}, null, 2) + '\n');
await mkdir(join(stage, 'THIRD-PARTY-LICENSES'), { recursive: true });
for (const name of ['pdfjs-dist', 'utif', 'pako']) {
  await cp(join(root, 'node_modules', name, 'LICENSE'), join(stage, 'THIRD-PARTY-LICENSES', name + '.txt'));
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const [archive] = JSON.parse(execFileSync(npm, ['pack', '--json', '--pack-destination', out], { cwd: stage, encoding: 'utf8' }));
for (const path of ['dist/pdf/workers/pdf.worker.js', 'dist/image/workers/tiff.worker.js', 'LICENSE']) {
  if (!archive.files.some(f => f.path === path)) throw Error(`Missing ${path}`);
}
await writeFile(join(out, 'viewer-package.json'), JSON.stringify({ file: archive.filename, integrity: archive.integrity, version: '0.1.2' }, null, 2) + '\n');
console.log(`Single-package install: npm install ./${archive.filename}`);
