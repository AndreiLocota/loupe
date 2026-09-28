// Copy the DOCX engine's WASM binary to a stable same-origin URL
// (/loupe/docx_parser_bg.wasm) so both the dev server and the production build
// serve the exact binary shipped with the installed @silurus/ooxml version.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';

const engineDist = dirname(fileURLToPath(import.meta.resolve('@silurus/ooxml/docx')));
await mkdir('public/loupe', { recursive: true });
await copyFile(join(engineDist, 'docx_parser_bg.wasm'), 'public/loupe/docx_parser_bg.wasm');
// Keep PDF and TIFF workers on the same origin as the playground.
// Prepend a Map#getOrInsertComputed shim: pdf.js 5 needs it and many browsers lack it.
const shim = `(()=>{for(const C of [Map,WeakMap]){const p=C.prototype;if(!p.getOrInsertComputed)Object.defineProperty(p,"getOrInsertComputed",{configurable:true,writable:true,value(k,f){if(this.has(k))return this.get(k);const v=f(k);this.set(k,v);return v}});if(!p.getOrInsert)Object.defineProperty(p,"getOrInsert",{configurable:true,writable:true,value(k,v){if(!this.has(k))this.set(k,v);return this.get(k)}})}})();\n`;
await writeFile('public/loupe/pdf.worker.js', shim + (await readFile('vendor/loupe-pdf/dist/workers/pdf.worker.js', 'utf8')));
await copyFile('vendor/loupe-image/dist/workers/tiff.worker.js', 'public/loupe/tiff.worker.js');
