# Getting Started

## Installation

Use Node.js 24 LTS. Clone this repository, run `npm ci`, then `npm run build` and `npm run pack:packages`. No private npm registry token is required for that workflow.

From your React application's folder, install Core, React and the PDF adapter from those archives (adjust the checkout path):

```sh
npm install ../loupe/artifacts/veridox-ai-loupe-core-0.3.1.tgz ../loupe/artifacts/veridox-ai-loupe-react-2.0.0.tgz ../loupe/artifacts/veridox-ai-loupe-pdf-2.0.0.tgz
```

For Word files, install `veridox-ai-loupe-docx-3.0.2.tgz` instead of the PDF archive. For images, install `veridox-ai-loupe-image-2.0.0.tgz`. Install Core alongside the selected adapters. These package names are not being offered on public npm by this repository. Current access and reuse remain subject to [LICENSE](../LICENSE).

Requires React `>=18` (`react` and `react-dom` are peer dependencies). The root package is private because it is a workspace, not the package consumers install.

## Quick Example

```tsx
import type { ChangeEvent } from 'react';
import { ViewerStore } from '@veridox-ai/loupe-core';
import { ViewerProvider, ViewerSurface } from '@veridox-ai/loupe-react';
import { useViewer, usePageNavigation, useZoom } from '@veridox-ai/loupe-react';
import { createPdfAdapterFactory } from '@veridox-ai/loupe-pdf';

const store = new ViewerStore();
store.registerFactory(createPdfAdapterFactory());

function Toolbar() {
  const viewer = useViewer(store);
  const { currentPage, pageCount, goToNext, goToPrev } = usePageNavigation(viewer);
  const { setZoom } = useZoom(viewer);

  return (
    <div>
      <button onClick={goToPrev} disabled={currentPage <= 1}>Prev</button>
      <span>{currentPage} / {pageCount}</span>
      <button onClick={goToNext} disabled={currentPage >= pageCount}>Next</button>
      <button onClick={() => setZoom(store.getZoom() + 0.25)}>Zoom In</button>
      <button onClick={() => setZoom('fit-width')}>Fit Width</button>
    </div>
  );
}

function App() {
  const viewer = useViewer(store);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    try {
      await viewer.loadDocument({ data });
    } catch {
      // loadDocument re-throws on failure; the error is also surfaced via
      // viewer.state.error (rendered below), so swallow the rejection here.
    }
  };

  return (
    <ViewerProvider store={store}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <input type="file" accept=".pdf" onChange={handleFile} />
        <Toolbar />
        {viewer.state.status === 'error' && (
          <div style={{ color: 'red' }}>{viewer.state.error?.message}</div>
        )}
        <ViewerSurface style={{ flex: 1 }} />
      </div>
    </ViewerProvider>
  );
}
```

> Note: `useZoom().current` reports `1` whenever the viewer is in a fit-mode
> (e.g. `'fit-width'`/`'fit-page'`) rather than a numeric scale. When stepping
> zoom in/out relative to what is actually on screen, read the true numeric
> scale from `store.getZoom()` (as the "Zoom In" button above does) instead of
> `useZoom().current`.

## Hooks

| Hook | Signature | Returns |
|---|---|---|
| `useViewer(store)` | `(ViewerStore) => UseViewerReturn` | `state`, `loadDocument`, `closeDocument`, `goToPage`, `setZoom`, `search`, `clearSearch`, `nextSearchMatch`, `previousSearchMatch`, `registerFactory`, `subscribe`, `cancelLoad` |
| `useCapabilities(store?)` | `(ViewerStore?) => AdapterCapabilities` | `pageCount`, `textSearch`, `textSelection`, `thumbnails`, `rotation`, `layers`, `annotations` — all booleans |
| `useStatus(viewer)` | `(UseViewerReturn) => UseStatusReturn` | `status`, `format`, `error`, `isIdle`, `isLoading`, `isLoaded`, `isError` |
| `useLoadDocument(store)` | `(ViewerStore) => UseLoadDocumentReturn` | `load(source)`, `status`, `format`, `error` |
| `usePageNavigation(viewer)` | `(UseViewerReturn) => UsePageNavigationReturn` | `currentPage`, `pageCount`, `goToPage`, `goToNext`, `goToPrev` |
| `useZoom(viewer)` | `(UseViewerReturn) => UseZoomReturn` | `current` (number), `setZoom` |
| `useSearch(viewer)` | `(UseViewerReturn) => UseSearchReturn` | `query`, `matches`, `activeIndex`, `search`, `clearSearch`, `nextMatch`, `previousMatch` |
| `useThumbnail(store, page, maxPx?)` | `(ViewerStore, number, number?) => UseThumbnailReturn` (`maxPx` defaults to `200`) | `thumbnail` (`ImageBitmap \| null`), `loading`, `error` |
| `useLayers(store?)` | `(ViewerStore?) => UseLayersReturn` | `supported`, `layers`, `setLayerVisibility(id, visible)` |
| `useAnnotations(store?)` | `(ViewerStore?) => UseAnnotationsReturn` | `supported`, `visible`, `setVisible(visible)`, `annotations`, `loading` |
| `useRotation(store?)` | `(ViewerStore?) => UseRotationReturn` | `supported`, `rotation`, `setRotation(degrees)`, `rotateCw`, `rotateCcw` |

## Components

| Component | Props | Purpose |
|---|---|---|
| `<ViewerProvider>` | `store?`, `children` | Context provider. Owns store lifecycle (auto-creates store if not provided). |
| `<ViewerSurface>` | `style?`, `className?` | Mount point for the document adapter. Calls `store.setMountElement()` on mount. |

## Registering Adapters

```ts
import { createPdfAdapterFactory } from '@veridox-ai/loupe-pdf';
import { createImageAdapterFactory } from '@veridox-ai/loupe-image';
import { createDocxAdapterFactory } from '@veridox-ai/loupe-docx';

const store = new ViewerStore();
store.registerFactory(createPdfAdapterFactory());
store.registerFactory(createImageAdapterFactory());
store.registerFactory(createDocxAdapterFactory());
```

DOCX thumbnails are **opt-in** (off by default, since they are heavier to
generate than PDF/image thumbnails). Enable them explicitly:

```ts
store.registerFactory(createDocxAdapterFactory({ thumbnails: true }));
```

## Asset delivery

Runtime assets ship inside the packages and must be reachable at runtime.
By default each is resolved relative to its module via `import.meta.url` (so a
standard bundler that emits the package's `dist/` assets works out of the box),
and each can be overridden through its factory option if you host the asset
yourself:

| Package | Asset (default path) | Override |
|---|---|---|
| `@veridox-ai/loupe-pdf` | `dist/workers/pdf.worker.js` | `createPdfAdapterFactory(workerSrc)` |
| `@veridox-ai/loupe-image` | `dist/workers/tiff.worker.js` | `createImageAdapterFactory({ tiffWorkerUrl })` |
| `@veridox-ai/loupe-docx` | `@silurus/ooxml/dist/docx_parser_bg.wasm` (+ worker) | `createDocxAdapterFactory({ wasmUrl })` |

```ts
store.registerFactory(createPdfAdapterFactory('/assets/pdf.worker.js'));
store.registerFactory(createImageAdapterFactory({ tiffWorkerUrl: '/assets/tiff.worker.js' }));
store.registerFactory(createDocxAdapterFactory({ wasmUrl: '/assets/docx_parser_bg.wasm' }));
```

The DOCX rendering engine (`@silurus/ooxml`) resolves its WASM binary and
parser worker itself; bundlers with `new URL(..., import.meta.url)` asset
support (Vite, webpack 5, Next.js) need no configuration, and `wasmUrl` is the
escape hatch for pipelines that can't emit those assets (e.g. plain esbuild).

HEIC support additionally uses a dynamic `import('heic-to/csp')` at runtime, so
your bundler must be able to resolve the `heic-to/csp` package.

## CSP Requirements

Add to your application's headers:

```
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' blob:;
object-src 'none'
```

The library is tested under this CSP in CI.

## Working Example

Run the example viewer from a fresh clone:

```bash
npm ci                 # installs the locked workspace dependencies
npm run build          # builds dist/ + the example bundle and worker assets
npm run dev
# Open http://127.0.0.1:5173/examples/
```

`npm install` and `npm run build` are required: `examples/index.html` import-maps
`pdfjs-dist` from `node_modules`, and the example bundle / worker assets are
generated (git-ignored), not committed.

See `examples/viewer-app.tsx` for the full implementation.
