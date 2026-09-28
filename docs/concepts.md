# Concepts

## Shell vs Adapter

The library is split into two layers:

- **Shell** — the consuming app: toolbar, page indicator, thumbnails, zoom controls. Owns 100% of the visual chrome. Talks only to `ViewerStore` and the `DocumentAdapter` interface.
- **Adapter** — the rendering engine for a specific format. Implements `DocumentAdapter` and is never accessed directly by the shell.

```
  Shell (your app)
       │
       ▼
  ViewerStore ──── DocumentAdapter ──── Engine (PDF.js, @silurus/ooxml, etc.)
       │
  DocumentAdapter ──── Another engine
```

## The Adapter Interface

Every format implements this interface. It is the library's **true public API**:

```ts
interface DocumentAdapter {
  load(source: DocumentSource, mount: HTMLElement, opts: LoadOptions): Promise<LoadedDocument>;
  destroy(): void;

  readonly capabilities: AdapterCapabilities;

  goToPage?(n: number): void;
  setZoom(scale: number | 'fit-width' | 'fit-page'): void;
  getZoom?(): number;
  search?(query: string): AsyncIterable<SearchMatch>;
  clearSearch?(): void;
  // One-shot match geometry for overlays; never touches interactive search state.
  findMatches?(query: string): Promise<SearchMatch[]>;
  // Precise scrolling to a rect in a page's native units (top-left origin).
  scrollToRect?(pageIndex: number, rect: DocumentRect, opts?: ScrollToRectOptions): Promise<void>;
  // Emphasise one match of the current search by its search() yield-order index.
  // Return a promise when activation has viewport side effects (see Search navigation).
  setActiveSearchMatch?(index: number | null): void | Promise<void>;
  getThumbnail?(page: number, maxPx: number): Promise<ImageBitmap>;

  getLayers?(): DocumentLayer[];
  setLayerVisibility?(id: string, visible: boolean): void;

  getAnnotationsVisible?(): boolean;
  setAnnotationsVisible?(visible: boolean): void;
  getAnnotations?(): Promise<DocumentAnnotation[]>;

  getRotation?(): number;
  setRotation?(degrees: number): void;
}
```

### Capabilities

The `capabilities` object tells the shell what the adapter supports. The shell degrades accordingly:

```ts
interface AdapterCapabilities {
  pageCount: boolean;      // PDF, DOCX: yes. Images: no
  textSearch: boolean;     // PDF, DOCX: yes. Images: no
  textSelection: boolean;  // PDF: yes
  thumbnails: boolean;     // PDF: yes; images (TIFF): yes; DOCX: opt-in
  rotation: boolean;       // PDF, images: yes
  layers: boolean;         // PDF optional-content groups (OCGs)
  annotations: boolean;    // PDF annotation layer (show/hide + inspection)
  viewport: boolean;       // live viewport metrics for content-tracking chrome
  scrollToRect: boolean;   // precise scroll to a document rect. PDF: yes
}
```

Rules:
- `capabilities` is always accurate. Never lie.
- If a capability says `false`, the shell hides the corresponding UI.
- If a capability says `true`, the corresponding method must exist and work.
- Never throw "not supported" from an optional method.

## ViewerStore — The State Machine

`ViewerStore` owns all viewer state and emits events. It is the single source of truth.

### States

```
idle → loading → loaded
              ↘ error
```

### State shape

```ts
interface ViewerState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  format: string | null;
  document: LoadedDocument | null;
  currentPage: number;
  zoom: number | 'fit-width' | 'fit-page';
  searchQuery: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  error: ViewerError | null;
}
```

### Events

```ts
type ViewerEvent =
  | { type: 'status-change'; status: ViewerStatus }
  | { type: 'page-change'; page: number }
  | { type: 'zoom-change'; zoom: ZoomMode }
  | { type: 'search-change'; query: string; matches: SearchMatch[]; activeIndex: number }
  | { type: 'error'; error: ViewerError };
```

Subscribe to events to update your shell UI:

```ts
store.subscribe((event) => {
  if (event.type === 'page-change') setPageIndicator(event.page);
});
```

### Search navigation

Stepping through matches moves the document, not just the counter:

- `nextSearchMatch()` / `previousSearchMatch()` (and a committed `search()`)
  automatically scroll to the newly active match and tell the adapter to
  emphasise it (`setActiveSearchMatch`). The PDF adapter styles the active
  highlight with the `loupe-search-highlight-active` class.
- An adapter whose activation moves the viewport on its own (the DOCX engine
  scrolls to the page top on every find-cursor step) must return a promise
  from `setActiveSearchMatch` that resolves once those side effects have
  settled: the store waits it out before issuing the precise scroll, so the
  match-centred scroll is always the last one issued. A synchronous activation
  returns nothing. Resolve rather than reject — the store treats a rejection
  as settled and scrolls anyway.
- `scrollToSearchMatch(index?, opts?)` scrolls to a specific match (default:
  the active one) — `opts.align` is `'center'` (default) or `'start'`.
- When the adapter supports `capabilities.scrollToRect`, navigation lands on
  the match's exact position; otherwise it falls back to page-level
  `goToPage`. A match with empty `bounds` (an adapter that cannot report
  geometry for that occurrence) is never navigated from.
- `SearchMatch.bounds` are in the page's native, un-rotated units with a
  top-left origin, and a match's position in `search()`'s yield order is the
  index `setActiveSearchMatch` receives. Matches are non-overlapping, in
  reading order.

## Format Detection

Format detection is by **magic bytes**, never by file extension or MIME type:

| Format | Signature |
|---|---|
| PDF | `%PDF` (`25 50 44 46`) at offset 0 |
| DOCX | `PK\x03\x04` + `[Content_Types].xml` in first 64KB |
| JPEG | `FF D8 FF` at offset 0 |
| PNG | `89 50 4E 47` at offset 0 |
| GIF | `47 49 46 38` (`GIF8`) at offset 0 |
| WebP | `52 49 46 46` (RIFF) at offset 0 **and** `57 45 42 50` (`WEBP`) at offset 8 |
| TIFF | `49 49 2A 00` (little-endian) or `4D 4D 00 2A` (big-endian) — both include the version-42 magic |
| SVG | Markup starting with `<` that contains `<svg` (case-insensitive; allows a leading XML prolog, DOCTYPE, or comment) |
| HEIC | `ftyp` brand `heic`, `heix`, `hevc`, `heif`, or `mif1` at offset 4 |

Unknown or ambiguous → refuse to render with a typed `UNSUPPORTED_FORMAT` error.

**Limitations to be aware of:**

- **AVIF is not detected.** There is no AVIF magic-byte signature, so AVIF
  files fall through to `UNSUPPORTED_FORMAT`.
- **A bare RIFF container is not treated as an image.** WebP requires both the
  `RIFF` prefix and the `WEBP` fourCC at offset 8, so `.wav`/`.avi` files
  (RIFF without `WEBP`) fall through to `UNSUPPORTED_FORMAT`.

## Error Taxonomy

All errors implement `ViewerError`:

```ts
interface ViewerError extends Error {
  code: ViewerErrorCode;
  format?: string;
  recoverable: boolean;
}
```

> Note: this is the intended error shape and there is a `createError()` helper
> that populates `recoverable`/`format`. However, `ViewerStore` currently throws
> code-tagged plain `Error`s (`Object.assign(new Error(msg), { code })`) for its
> own failures, so on store-emitted errors only `code` and `message` are
> guaranteed — `recoverable` and `format` may be `undefined`. Treat the
> "Recoverable" column below as guidance, not a runtime contract.

| Code | Description | Recoverable |
|---|---|---|
| `UNSUPPORTED_FORMAT` | Format not recognized | No |
| `NO_ADAPTER_REGISTERED` | No factory for detected format | No |
| `NO_MOUNT_ELEMENT` | Mount element not set before load | No |
| `LOAD_FAILED` | Engine failed to load document | Yes |
| `DECODE_ERROR` | Decoder reported an error | No |
| `SECURITY_ERROR` | Document violated a security boundary | No |
| `RESOURCE_EXHAUSTED` | Size/dimension/expansion cap exceeded | No |
| `PASSWORD_REQUIRED` | Encrypted document, no password provided | Yes |
| `CANCELLED` | Load cancelled by user or abort signal | Yes |
| `WORKER_TERMINATED` | Decoder worker crashed | No |
| `TIMEOUT` | Decode exceeded time limit | Yes |

## Cancellation

All operations are cancellable via `AbortSignal`:

```ts
const controller = new AbortController();
store.loadDocument(source, { signal: controller.signal });

// Later:
controller.abort();  // Store transitions back to idle
```

`ViewerStore` wraps this in `CancellationTokenSource` for internal use. Closing a document terminates all workers and WASM instantly.

## Worker Architecture

Heavy parsing/decoding runs off the main thread, but not every stage does — the
split differs per adapter:

- **PDF (`@veridox-ai/loupe-pdf`)** uses the PDF.js worker for **parsing** the
  document. **Page rendering happens on the main thread**, drawing to a
  `<canvas>` via `page.render()` — the worker does not return decoded page
  bitmaps.
- **Images (`@veridox-ai/loupe-image`)** decode multi-page **TIFF** in a
  dedicated worker; that worker is the one case that returns decoded frames back
  to the main thread. Other image formats (JPEG/PNG/GIF/SVG) decode natively via
  the browser, and HEIC is decoded on the main thread via `heic-to/csp`.

```
Main thread                    Web Worker
───────────                    ──────────
ViewerStore                    PDF worker (PDF.js) — parses the document
  │                                │
  ├── load() ────── postMessage ──►│
  │◄── parsed page data ───────────┤
  │                                │
  ├── page.render() → <canvas>     │   (rendering stays on the main thread)
  │                                │
  ├── destroy() ── terminate() ───►│

Main thread                    Web Worker
───────────                    ──────────
ImageAdapter                   TIFF worker — decodes frames
  │                                │
  ├── decode() ──── postMessage ──►│
  │◄── decoded frame ── transfer ──┤
```

One document = its own worker set. Closing the document terminates workers — this is also the memory-leak strategy.
