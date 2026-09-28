# @veridox-ai/loupe-docx

DOCX adapter for the [Loupe](https://github.com/veridox-ai/tools.loupe) headless
document viewer. Renders to canvas via [@silurus/ooxml](https://ooxml.silurus.dev/)
(Rust compiled to WebAssembly, parsing in a Web Worker) — untrusted document
content never becomes live markup. ZIP hygiene (size/ratio/entry-count/
path-traversal caps) runs before any bytes reach the engine, and the engine
enforces its own decompression and image-memory budgets. Real pagination, text
selection through an inert overlay, search with per-match geometry, and
password-protected documents (Agile Encryption, decrypted client-side) are
supported. Thumbnails are opt-in.

```bash
npm install @veridox-ai/loupe-core @veridox-ai/loupe-docx
```

```ts
import { createDocxAdapterFactory } from '@veridox-ai/loupe-docx';
store.registerFactory(createDocxAdapterFactory({ thumbnails: true }));
```

## Assets

The engine ships `.wasm` and worker files as real assets resolved with
`new URL(..., import.meta.url)`. Bundlers with asset support (Vite, webpack 5,
Next.js) need no configuration. If yours can't resolve them (e.g. plain
esbuild), copy `docx_parser_bg.wasm` from `@silurus/ooxml/dist` to your served
output and pass its URL: `createDocxAdapterFactory({ wasmUrl })`.

## Content Security Policy

Consumers with a strict CSP need two directives for the engine:

- `script-src … 'wasm-unsafe-eval'` — WebAssembly compilation
- `worker-src 'self'` — the parser Worker

No inline script, `eval`, remote origin, or network access is required; the
adapter makes no requests beyond same-origin asset loads.

- [Getting Started](https://github.com/veridox-ai/tools.loupe/blob/main/docs/getting-started.md)
- [Security](https://github.com/veridox-ai/tools.loupe/blob/main/SECURITY.md)

Proprietary — distributed via Veridox's private registry. See
[LICENSE](https://github.com/veridox-ai/tools.loupe/blob/main/LICENSE).
