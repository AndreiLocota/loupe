# @veridox-ai/loupe-image

Image adapter for the [Loupe](https://github.com/veridox-ai/tools.loupe) headless
document viewer. Handles native raster formats (JPEG/PNG/GIF/WebP), SVG (rendered
inertly via a blob `<img>`), multi-page TIFF (decoded in a Web Worker), and HEIC
(via a runtime `import('heic-to/csp')`).

```bash
npm install @veridox-ai/loupe-core @veridox-ai/loupe-image
```

```ts
import { createImageAdapterFactory } from '@veridox-ai/loupe-image';
store.registerFactory(createImageAdapterFactory());
```

The TIFF worker (`dist/workers/tiff.worker.js`) must be reachable at runtime; it
resolves via `import.meta.url` by default and is overridable:
`createImageAdapterFactory({ tiffWorkerUrl })`. HEIC decoding additionally needs
your bundler to resolve a dynamic `import('heic-to/csp')`; heic-to's CSP build
decodes via WASM libheif and requires no `'unsafe-eval'`.

- [Getting Started](https://github.com/veridox-ai/tools.loupe/blob/main/docs/getting-started.md)
- [Security](https://github.com/veridox-ai/tools.loupe/blob/main/SECURITY.md)

Proprietary — distributed via Veridox's private registry. See
[LICENSE](https://github.com/veridox-ai/tools.loupe/blob/main/LICENSE).
