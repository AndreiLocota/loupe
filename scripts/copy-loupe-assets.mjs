// Copy the DOCX engine's WASM binary to a stable same-origin URL
// (/loupe/docx_parser_bg.wasm) so both the dev server and the production build
// serve the exact binary shipped with the installed @silurus/ooxml version.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, copyFile } from 'node:fs/promises';

const engineDist = dirname(fileURLToPath(import.meta.resolve('@silurus/ooxml/docx')));
await mkdir('public/loupe', { recursive: true });
await copyFile(join(engineDist, 'docx_parser_bg.wasm'), 'public/loupe/docx_parser_bg.wasm');
