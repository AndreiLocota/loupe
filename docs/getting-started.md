# Getting Started

## Installation

Use Node.js 24 LTS for development. In your application:

```sh
npm install https://github.com/AndreiLocota/loupe/releases/download/v0.1.3/andreilocota-loupe-0.1.3.tgz
```

One prebuilt package includes the core, PDF, DOCX and image adapters, plus optional React bindings. No GitHub login, clone or library build is required. Plain TypeScript apps do not need React; the example below uses React and React DOM >=18 from your app.

Free for personal, commercial and production use. No separate approval is required. You may ship Loupe within your applications; standalone redistribution of the library, SDK or package is prohibited. See the [download licence](https://tryloupe.lovable.app/downloads/LOUPE-LICENSE.txt). The public [plain TypeScript example](https://tryloupe.lovable.app/downloads/README.md) includes file selection and mounting.

## Quick Example

```tsx
import type { ChangeEvent } from 'react';
import { ViewerStore } from '@andreilocota/loupe';
import { ViewerProvider, ViewerSurface } from '@andreilocota/loupe/react';
import { useViewer, usePageNavigation, useZoom } from '@andreilocota/loupe/react';
import { createPdfAdapterFactory } from '@andreilocota/loupe/pdf';

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
import { createPdfAdapterFactory } from '@andreilocota/loupe/pdf';
import { createImageAdapterFactory } from '@andreilocota/loupe/image';
import { createDocxAdapterFactory } from '@andreilocota/loupe/docx';

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

Runtime assets ship inside the package and must be reachable at runtime.
By default each is resolved relative to its module via `import.meta.url` (so a
standard bundler that emits the package's `dist/` assets works out of the box),
and each can be overridden through its factory option if you host the asset
yourself:

| Package | Asset (default path) | Override |
|---|---|---|
| `@andreilocota/loupe/pdf` | `dist/pdf/workers/pdf.worker.js` | `createPdfAdapterFactory(workerSrc)` |
| `@andreilocota/loupe/image` | `dist/image/workers/tiff.worker.js` | `createImageAdapterFactory({ tiffWorkerUrl })` |
| `@andreilocota/loupe/docx` | `@silurus/ooxml/dist/docx_parser_bg.wasm` (+ worker) | `createDocxAdapterFactory({ wasmUrl })` |

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

## Repository reference viewer (maintainers)

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
