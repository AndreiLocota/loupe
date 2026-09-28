# @veridox-ai/loupe-pdf

PDF adapter for the [Loupe](https://github.com/veridox-ai/tools.loupe) headless
document viewer. Wraps PDF.js (`pdfjs-dist` v6): canvas rendering, virtualized
scroll, text layer + selection, search with per-match highlight, thumbnails,
rotation, optional-content layers (OCG), annotations, and safe links.

```bash
npm install @veridox-ai/loupe-core @veridox-ai/loupe-pdf
```

```ts
import { createPdfAdapterFactory } from '@veridox-ai/loupe-pdf';
store.registerFactory(createPdfAdapterFactory());
```

The PDF worker (`dist/workers/pdf.worker.js`) must be reachable at runtime; it
resolves via `import.meta.url` by default and is overridable:
`createPdfAdapterFactory(workerSrc)`.

- [Getting Started](https://github.com/veridox-ai/tools.loupe/blob/main/docs/getting-started.md)
- [Security](https://github.com/veridox-ai/tools.loupe/blob/main/SECURITY.md)

Proprietary — distributed via Veridox's private registry. See
[LICENSE](https://github.com/veridox-ai/tools.loupe/blob/main/LICENSE).
