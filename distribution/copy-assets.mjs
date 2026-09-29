#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = dirname(fileURLToPath(import.meta.url));
const destination = resolve(process.argv[2] || 'public/loupe');
const ooxml = dirname(fileURLToPath(import.meta.resolve('@silurus/ooxml/docx')));
await mkdir(destination, { recursive: true });
for (const [source, name] of [
  [join(packageRoot, 'dist/pdf/workers/pdf.worker.js'), 'pdf.worker.js'],
  [join(packageRoot, 'dist/image/workers/tiff.worker.js'), 'tiff.worker.js'],
  [join(ooxml, 'docx_parser_bg.wasm'), 'docx_parser_bg.wasm'],
]) await copyFile(source, join(destination, name));
console.log(`Loupe runtime assets copied to ${destination}`);
