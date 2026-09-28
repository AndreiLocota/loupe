# Security Guide for Embedders

This guide covers what **you** (the consuming application) must do to embed the viewer securely. The library guarantees the invariants below when these rules are followed.

## Required CSP

Add this `Content-Security-Policy` header to every page that hosts the viewer:

```
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' blob:;
object-src 'none'
```

**Do not add `'unsafe-inline'` to `script-src`.** The library's React bindings work without inline scripts.

If you need to relax CSP for your own application code, use nonces or hashes — never blanket allow inline scripts.

## What the Library Guarantees

When embedded under the CSP above:

1. **No script execution from documents** — PDF JS actions, XFA scripting, SVG `<script>` — all inert
2. **No network requests from document content** — remote images, external entities, URI actions are dropped; tested in CI with a network interceptor
3. **No auto-navigation from document content** — hyperlinks are never auto-followed. DOCX link clicks are intercepted by the adapter's engine callback; only `http(s)`/`mailto` targets emit a `link-click` intent as a same-origin window message. **That intent is not yet consumed by a public shell callback** — there is currently no wired link-callback API, so external links simply do not navigate (internal bookmark links scroll within the document). Auto-routing link intents to a shell callback is planned but not implemented.
4. **No document-authored markup reaches the DOM** — DOCX renders to canvas (Rust→WASM engine); the only DOM the document influences is the engine's inert text-selection overlay (transparent, position-only spans). SVG in the image adapter renders exclusively via `<img src=blob:>`, so no inline SVG (and no `foreignObject`) reaches the live DOM.
5. **Decoder crashes are contained** — workers+WASM; a crash surfaces as a typed error, never a frozen tab

## What You Must Do

### 1. Apply the CSP

The CSP header is **mandatory**. Without it, the library cannot guarantee containment of malicious document content.

### 2. Serve Build Assets Self-Hosted

Three build assets must be served from your own origin (never a CDN). By default
each is resolved relative to its module via `import.meta.url`; if your bundler
can't resolve it that way (e.g. when consuming a pre-built bundle), pass an
explicit URL to the corresponding factory:

| Package | Asset | Override |
|---|---|---|
| `@veridox-ai/loupe-pdf` | `dist/workers/pdf.worker.js` | `createPdfAdapterFactory(workerSrc)` |
| `@veridox-ai/loupe-image` | `dist/workers/tiff.worker.js` | `createImageAdapterFactory({ tiffWorkerUrl })` |
| `@veridox-ai/loupe-docx` | `@silurus/ooxml/dist/docx_parser_bg.wasm` (+ parser worker) | `createDocxAdapterFactory({ wasmUrl })` |

The DOCX assets belong to the rendering engine (`@silurus/ooxml`) and resolve
from its own `dist/` via `new URL(..., import.meta.url)`; bundlers with asset
support emit them automatically. `wasmUrl` is only needed when your pipeline
can't do that (e.g. plain esbuild) — copy the `.wasm` to your own origin, never
a third-party CDN.

### 3. Links Do Not Auto-Navigate (No Callback Yet)

Hyperlinks from documents are never auto-followed. In the DOCX adapter, link
clicks are intercepted by the adapter's engine callback (which replaces the
engine's default `window.open` behaviour entirely) and, for `http(s)`/`mailto`
schemes, a `link-click` intent is posted as a same-origin window message.

**There is currently no public link-callback API**: the emitted intent is not
consumed by the adapter or store, so links do nothing when clicked. You do not
need to (and cannot yet) wire a handler. A shell link-callback that relays these
intents — with the scheme allowlist applied — is planned. When you build your
own link UI in the meantime, still validate schemes and **never** open
`javascript:`, `data:`, or `file:` URLs:

```ts
function handleLink(url: string) {
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
    if (confirm(`Open ${url}?`)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
```

### 4. Input Size and Resource Limits

There is **no configurable global input-size cap** (`LoadOptions` is only
`{ signal?, initialPage?, initialZoom?, password? }` — there is no `maxSize`
option). The real, enforced protections are:

- **DOCX zip hygiene** (before any bytes reach the rendering engine): reject
  archives over ~100 MB, any entry over ~50 MB uncompressed, expansion ratio
  over 100:1, more than 10,000 entries, or any entry name containing `..`
  (path traversal).
- **DOCX engine budgets** (second layer, enforced by `@silurus/ooxml`):
  per-entry and aggregate decompression caps and a decoded-image memory budget;
  violations surface as `RESOURCE_EXHAUSTED`.
- **DOCX render timeout**: a render that does not complete within 30 seconds is
  aborted with a typed error.

PDF and image inputs currently have **no pre-parse size cap** — they are bounded
only by the browser/decoder. If you need to reject oversized uploads, enforce a
size limit in your own application code before calling `loadDocument`.

### 5. Password Handling

If a document requires a password, the library emits a `PASSWORD_REQUIRED` error. Your shell should prompt the user and retry:

```ts
try {
  await store.loadDocument(source);
} catch (err) {
  if ((err as ViewerError).code === 'PASSWORD_REQUIRED') {
    const password = await promptForPassword();
    await store.loadDocument(source, { password });
  }
}
```

## Defense in Depth

The library uses multiple layers of containment:

| Layer | What it protects against |
|---|---|
| **CSP** (host app) | Script injection, remote resource loads |
| **Canvas-only rendering** (DOCX) | Document content is drawn, never injected — no HTML/CSS from the document reaches the live DOM |
| **Worker isolation** (PDF, DOCX, images) | Parser/decoder crashes and WASM memory corruption stay off the main thread |
| **Pre-decode caps** | Decompression bombs, dimension bombs (zip hygiene + engine budgets) |
| **Scheme allowlist** (links) | Only `http(s)`/`mailto` link clicks emit an intent; everything else (`javascript:`, `data:`, `file:` …) is dropped |

A single layer failure does not compromise the system.

### The DOCX rendering security model in detail

The DOCX adapter renders with `@silurus/ooxml`: Rust parsers compiled to
WebAssembly, running in a **Web Worker**, drawing to `<canvas>` on the main
thread. There is no iframe and no sanitiser because there is nothing to
sanitise — document content never becomes live markup:

- **Canvas-only output.** Text, images, tables and shapes are painted onto
  canvas. The only DOM derived from document content is the engine's
  text-selection overlay: transparent, absolutely-positioned spans carrying
  text and geometry only, plus highlight rectangles. No document-authored
  attributes, styles sheets, or URLs are attached to them.
- **No network by default.** The engine performs no fetches beyond loading its
  own same-origin `.wasm`/worker assets; remote image references inside
  documents are not fetched (asserted in CI with a network interceptor). The
  adapter never enables the engine's optional Google Fonts fetching.
- **XXE-safe XML parsing** (`roxmltree` resolves no external entities), and
  **memory-safe parsing** (Rust/WASM) with the WASM sandbox containing any
  parser fault inside the worker.
- **Layered resource limits**: the adapter's zip hygiene runs before any bytes
  reach the engine; the engine's own decompression and decoded-image budgets
  back it up.
- **Encrypted documents** (Agile Encryption) are decrypted client-side via
  WebCrypto; neither bytes nor passwords leave the browser.

### SVG and `foreignObject`

No `foreignObject` ever reaches a live DOM: the image adapter renders SVG
inert via `<img src=blob:>`, and DOCX thumbnails are rendered by the WASM
engine straight to an `ImageBitmap` (the pre-3.0 SVG-`foreignObject`
rasterisation path no longer exists).

## Testing Your Embedding

The library's test suite includes malicious documents that exercise each attack vector. You can run the security suite against your own embedding:

```bash
npm run test:security
```

This runs under the CSP, with network interception, verifying:
- No script execution
- No network requests from document content
- No navigation from document content
- Proper cleanup on document close
