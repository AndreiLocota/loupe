interface DocumentSource {
    data: ArrayBuffer | Blob;
    mimeType?: string;
    fileName?: string;
}
interface Size {
    width: number;
    height: number;
}
interface PageInfo {
    index: number;
    dimensions: Size;
    rotation: number;
}
type ZoomMode = number | "fit-width" | "fit-page";
/** Geometry of one laid-out page within the scroll content, in CSS pixels at
 * the current scale. `x`/`y` are offsets from the content's top-left origin and
 * `width`/`height` are the on-screen (post-rotation) box. `nativeWidth`/
 * `nativeHeight` are the page's un-rotated size in its native document units
 * (PDF points / image pixels) — the space bounding boxes are expressed in. */
interface PageRect {
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    nativeWidth: number;
    nativeHeight: number;
}
/** An axis-aligned rectangle in a page's native, un-rotated document units
 * (top-left origin): PDF points or image pixels. */
interface DocumentRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * A snapshot of how document content is currently laid out in the viewport.
 * All measurements are CSS pixels. This is the data an embedder needs to draw
 * chrome that must track the content — rulers, guides, measurement tools,
 * minimaps, comment pins — without knowing the adapter's internal layout.
 *
 * Screen X of a content coordinate `cx` is `cx - scroll.x` (plus the ruler's
 * own origin); the value in document units is `cx / scale` (see `unit`).
 */
interface ViewportMetrics {
    /** Resolved numeric zoom (1 = 100%). */
    scale: number;
    /** Display rotation in degrees (normalized 0/90/180/270). Page rects already
     * reflect it (width/height swap at 90/270); it's exposed so overlays anchored
     * to the document (e.g. guides) can rotate with the content. */
    rotation: number;
    /** Scroll offset of the content within the viewport. */
    scroll: {
        x: number;
        y: number;
    };
    /** Total scrollable content size. */
    content: Size;
    /** Visible viewport size (excludes scrollbars). */
    client: Size;
    /** Backing-store ratio, for crisp tick rendering on HiDPI displays. */
    devicePixelRatio: number;
    /** Native unit of one content pixel at `scale === 1`: PDF points, or image pixels. */
    unit: "pt" | "px";
    /** Per-page rectangles in content coordinates (may be empty before layout). */
    pages: PageRect[];
}
/** One text match. `bounds` are in the page's native, un-rotated document
 * units with a **top-left origin** (the space {@link projectRect} consumes),
 * for both `search()` and `findMatches()`. Matches are non-overlapping and
 * yielded in reading order (page-ascending); a match's position in `search()`'s
 * yield order is the index `setActiveSearchMatch` receives. An empty `bounds`
 * means the adapter cannot report geometry (e.g. DOCX searches inside its
 * iframe) — consumers must not navigate from such a match. */
interface SearchMatch {
    pageIndex: number;
    text: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
}
/** Options for {@link DocumentAdapter.scrollToRect}. */
interface ScrollToRectOptions {
    /** Scroll animation. Default 'smooth'. */
    behavior?: ScrollBehavior;
    /** Where the rect lands in the viewport. Default 'center'. */
    align?: "center" | "start";
}
interface LoadOptions {
    signal?: AbortSignal;
    initialPage?: number;
    initialZoom?: ZoomMode;
    password?: string;
}
interface LoadedDocument {
    pageCount: number;
    pages: PageInfo[];
    version?: string;
    metadata?: Record<string, string>;
}
interface AdapterCapabilities {
    pageCount: boolean;
    textSearch: boolean;
    textSelection: boolean;
    thumbnails: boolean;
    rotation: boolean;
    /** Toggling optional content groups / layers (PDF OCGs). */
    layers: boolean;
    /** Showing/hiding the annotation layer (PDF /Annots: links, markup, etc.). */
    annotations: boolean;
    /** Exposing live viewport metrics (scale/scroll/page geometry) for chrome
     * that tracks content, e.g. rulers and guides. */
    viewport: boolean;
    /** Precise scrolling to a DocumentRect on a page (`scrollToRect`). */
    scrollToRect: boolean;
}
/**
 * A toggleable content layer. For PDF these are Optional Content Groups (OCGs);
 * `id` is the group identifier used to toggle visibility.
 */
interface DocumentLayer {
    id: string;
    name: string;
    visible: boolean;
}
/**
 * Metadata for a single annotation, for inspection (e.g. forensic review).
 * Fields other than the first four are only present when the source provides
 * them. Dates are the raw values from the document (not reformatted).
 */
interface DocumentAnnotation {
    id: string;
    pageIndex: number;
    subtype: string;
    rect: [number, number, number, number];
    contents?: string;
    author?: string;
    created?: string;
    modified?: string;
    color?: string;
    url?: string;
    fieldName?: string;
    fieldValue?: string;
    /** Id of the optional content group this annotation belongs to, if any. */
    layerId?: string;
}
interface DocumentAdapter {
    load(source: DocumentSource, mount: HTMLElement, opts: LoadOptions): Promise<LoadedDocument>;
    destroy(): void;
    readonly capabilities: AdapterCapabilities;
    goToPage?(n: number): void;
    setZoom(scale: ZoomMode): void;
    /** The current resolved zoom as a numeric scale factor (1 = 100%). */
    getZoom?(): number;
    search?(query: string): AsyncIterable<SearchMatch>;
    clearSearch?(): void;
    /** Scroll the viewport so `rect` (native, un-rotated document units,
     * top-left origin — the {@link projectRect} space) on page `pageIndex` is
     * visible. Resolves once the scroll has been issued against settled page
     * layout. */
    scrollToRect?(pageIndex: number, rect: DocumentRect, opts?: ScrollToRectOptions): Promise<void>;
    /** Mark which match of the CURRENT interactive search is active, by its
     * position in `search()`'s yield order, or `null` for none. Drives distinct
     * styling of the active highlight. An adapter whose activation has engine
     * side effects that move the viewport (DOCX walks the engine's find cursor,
     * which scrolls on its own) must return a promise resolving once those
     * effects have settled, so the store can issue its precise scroll after
     * them; a synchronous activation returns nothing. Implementations should
     * resolve rather than reject — the store treats a rejection as settled and
     * scrolls anyway. */
    setActiveSearchMatch?(index: number | null): void | Promise<void>;
    /** One-shot text location: return every match for `query` WITHOUT changing
     * interactive search state or drawing highlights. Powers overlays (marks)
     * that need a text region's geometry. Text-capable formats only.
     *
     * `bounds` are in the page's native, un-rotated document units with a
     * **top-left origin** (the space {@link projectRect} consumes) — PDF flips
     * from its native bottom-left; DOCX reports un-zoomed CSS pixels. */
    findMatches?(query: string): Promise<SearchMatch[]>;
    getThumbnail?(page: number, maxPx: number): Promise<ImageBitmap>;
    /** Optional content layers for the loaded document (empty if none). */
    getLayers?(): DocumentLayer[];
    /** Show/hide a layer by id and re-render affected pages. */
    setLayerVisibility?(id: string, visible: boolean): void;
    /** Whether the annotation layer is currently shown. */
    getAnnotationsVisible?(): boolean;
    /** Show/hide the annotation layer and re-render affected pages. */
    setAnnotationsVisible?(visible: boolean): void;
    /** All annotations in the document with metadata, for inspection. */
    getAnnotations?(): Promise<DocumentAnnotation[]>;
    /** Current display rotation in degrees (normalized to 0/90/180/270). */
    getRotation?(): number;
    /** Set the display rotation (degrees) and re-render affected pages. */
    setRotation?(degrees: number): void;
    /** Current viewport metrics, or `null` before content is laid out. */
    getViewport?(): ViewportMetrics | null;
    /** Subscribe to viewport changes (scroll / zoom / resize / relayout).
     * Returns an unsubscribe function. */
    subscribeViewport?(callback: () => void): () => void;
}
interface AdapterFactory {
    readonly format: DocumentFormat;
    readonly capabilities: AdapterCapabilities;
    create(): DocumentAdapter;
}
type DocumentFormat = "pdf" | "docx" | "image";

interface CancellationToken {
    readonly aborted: boolean;
    readonly signal: AbortSignal;
    readonly abortError: Error;
    throwIfAborted(): void;
}
declare class CancellationTokenSource {
    private controller;
    private _aborted;
    get token(): CancellationToken;
    cancel(): void;
    get aborted(): boolean;
}

declare function detectFormat(source: DocumentSource): Promise<DocumentFormat | null>;

interface ViewerError extends Error {
    code: ViewerErrorCode;
    format?: string;
    recoverable: boolean;
}
type ViewerErrorCode = 'UNSUPPORTED_FORMAT' | 'NO_ADAPTER_REGISTERED' | 'NO_MOUNT_ELEMENT' | 'LOAD_FAILED' | 'DECODE_ERROR' | 'SECURITY_ERROR' | 'RESOURCE_EXHAUSTED' | 'PASSWORD_REQUIRED' | 'CANCELLED' | 'WORKER_TERMINATED' | 'TIMEOUT';
declare function createError(code: ViewerErrorCode, message: string, opts?: {
    format?: string;
    recoverable?: boolean;
}): ViewerError;

type EventCallback<T> = (event: T) => void;
declare class EventBus<T> {
    private listeners;
    subscribe(callback: EventCallback<T>): () => void;
    emit(event: T): void;
    clear(): void;
    get listenerCount(): number;
}

type ViewerStatus = "idle" | "loading" | "loaded" | "error";
interface ViewerState {
    status: ViewerStatus;
    format: string | null;
    document: LoadedDocument | null;
    currentPage: number;
    zoom: ZoomMode;
    searchQuery: string;
    searchMatches: SearchMatch[];
    activeSearchMatchIndex: number;
    error: ViewerError | null;
}
type ViewerEvent = {
    type: "status-change";
    status: ViewerStatus;
} | {
    type: "page-change";
    page: number;
} | {
    type: "zoom-change";
    zoom: ZoomMode;
} | {
    type: "search-change";
    query: string;
    matches: SearchMatch[];
    activeIndex: number;
} | {
    type: "error";
    error: ViewerError;
};
type ViewerEventCallback = (event: ViewerEvent) => void;
declare class ViewerStore {
    private state;
    private adapter;
    private mountElement;
    private events;
    private loadCancellation;
    private searchSeq;
    private scrollToMatchSeq;
    private viewportListeners;
    private adapterViewportUnsub;
    private navIntent;
    private registeredFactories;
    registerFactory(factory: AdapterFactory): void;
    getState(): Readonly<ViewerState>;
    /**
     * Current zoom as a resolved numeric scale (1 = 100%). Unlike `state.zoom`
     * (which may be a mode like 'fit-width'), this reflects what the adapter
     * actually applied — useful for stepping zoom in/out from the real value.
     */
    getZoom(): number;
    /**
     * Live viewport metrics (scale, scroll, per-page geometry) for the current
     * document, or `null` when nothing is loaded or the adapter doesn't support
     * it (`capabilities.viewport === false`). Read fresh on each viewport change
     * — see {@link subscribeViewport}.
     */
    getViewport(): ViewportMetrics | null;
    /**
     * Subscribe to viewport changes (scroll / zoom / resize / relayout). Returns
     * an unsubscribe function. The subscription persists across document loads.
     */
    subscribeViewport(callback: () => void): () => void;
    /**
     * Resolve every occurrence of `query` to its match geometry without touching
     * interactive search state or drawing highlights — for building overlays
     * (e.g. marks/highlights) from text. Returns `[]` when unsupported.
     */
    locate(query: string): Promise<SearchMatch[]>;
    /** (Re)bind the viewport bridge to the current adapter after an adapter swap. */
    private rebindViewport;
    /** Start (or replace) a navigation intent targeting `page` (1-based). */
    private armNavIntent;
    /**
     * Derive `currentPage` from live viewport geometry (greatest visible area —
     * see {@link computeVisiblePage}) so the page indicator follows scrolling.
     * Only trusts adapters reporting one rect per document page with a real
     * viewport size: aggregate geometry (DOCX's single content rect) and
     * frame-at-a-time reporting (TIFF) fail the count guard and keep their
     * existing navigation-driven behaviour, with no format checks needed.
     */
    private trackCurrentPage;
    /**
     * Capabilities of the adapter for the currently loaded document, or `null`
     * when nothing is loaded. Lets the shell decide which affordances to show
     * (e.g. a thumbnail rail only when `thumbnails` is supported).
     */
    getCapabilities(): AdapterCapabilities | null;
    /**
     * Toggleable content layers (PDF optional content groups) for the loaded
     * document. Empty when the adapter doesn't support layers or the document
     * has none.
     */
    getLayers(): DocumentLayer[];
    /** Show or hide a content layer by id. No-op if layers aren't supported. */
    setLayerVisibility(id: string, visible: boolean): void;
    /**
     * Whether the annotation layer (links, markup, form appearances) is shown.
     * Defaults to `true`; `false` when the adapter doesn't support annotations.
     */
    areAnnotationsVisible(): boolean;
    /** Show or hide the annotation layer. No-op if annotations aren't supported. */
    setAnnotationsVisible(visible: boolean): void;
    /**
     * All annotations in the loaded document with metadata, for inspection.
     * Empty when the adapter doesn't support annotations.
     */
    getAnnotations(): Promise<DocumentAnnotation[]>;
    /** Current display rotation in degrees, or 0 when rotation isn't supported. */
    getRotation(): number;
    /** Set absolute display rotation (degrees). No-op if rotation isn't supported. */
    setRotation(degrees: number): void;
    /** Rotate by a relative delta (default +90°). No-op if rotation isn't supported. */
    rotate(delta?: number): void;
    subscribe(callback: ViewerEventCallback): () => void;
    loadDocument(source: DocumentSource, opts?: LoadOptions): Promise<void>;
    cancelLoad(): void;
    closeDocument(): void;
    setMountElement(el: HTMLElement | null): void;
    goToPage(page: number): void;
    setZoom(zoom: ZoomMode): void;
    search(query: string): Promise<void>;
    clearSearch(): void;
    nextSearchMatch(): void;
    previousSearchMatch(): void;
    /**
     * Scroll the document to a search match — by default the active one; passing
     * `index` also makes that match active (clamped, emits 'search-change').
     * Uses the adapter's precise `scrollToRect` when supported, falls back to
     * page-level `goToPage`, and does nothing for matches without geometry
     * (`bounds: []`, e.g. DOCX's iframe-side search).
     */
    scrollToSearchMatch(index?: number, opts?: ScrollToRectOptions): Promise<void>;
    getThumbnail(page: number, maxPx?: number): Promise<ImageBitmap | null>;
    private detectFormat;
    private setState;
}

/** An axis-aligned rectangle in the viewer's client (viewport) pixel space.
 * (Named to avoid shadowing the deprecated DOM `ClientRect` global.) */
interface ViewportRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Project a rectangle given in a page's native, un-rotated document units
 * (top-left origin — PDF points / image pixels) to its current on-screen
 * position in the viewer's client space, accounting for scale, scroll, and
 * rotation. Returns `null` if the page isn't laid out yet.
 *
 * This is the anchoring primitive for chrome that must track a document region
 * — highlights/marks, guides, measurement, comment pins — across zoom, pan and
 * rotation, without the embedder reimplementing the per-adapter geometry.
 */
declare function projectRect(metrics: ViewportMetrics, pageIndex: number, rect: DocumentRect): ViewportRect | null;
/** Smallest rect containing all of `rects`, or `null` for an empty list.
 * Same coordinate space in, same space out. */
declare function unionRects(rects: DocumentRect[]): DocumentRect | null;
/**
 * Compute the absolute scroll offset that brings `rect` (native, un-rotated
 * document units, top-left origin) on page `pageIndex` into view. Builds on
 * {@link projectRect}, so scale, scroll and rotation are all accounted for —
 * the result is scroll-invariant (adding the current scroll back to the
 * projected client position yields a content coordinate), which keeps it
 * correct even while a previous smooth scroll is still in flight. Returns
 * `null` if the page isn't laid out yet.
 */
declare function computeScrollTarget(metrics: ViewportMetrics, pageIndex: number, rect: DocumentRect, align?: "center" | "start"): {
    left: number;
    top: number;
} | null;

/**
 * The page (0-based index) the user would say they are "on": the page whose
 * rect has the greatest visible area — the largest intersection with the
 * viewport (derived from `scroll` + `client`). Ties resolve to the lower
 * index. If no page intersects the viewport at all (e.g. the viewport sits
 * inside a margin gap), the page whose centre is nearest the viewport centre
 * wins. Returns `null` when `pages` is empty (layout not reported yet).
 *
 * Pure geometry over {@link ViewportMetrics} — no adapter or DOM access — so
 * it works for any adapter that reports true per-page rects.
 */
declare function computeVisiblePage(metrics: ViewportMetrics): number | null;

export { type AdapterCapabilities, type AdapterFactory, type CancellationToken, CancellationTokenSource, type DocumentAdapter, type DocumentAnnotation, type DocumentFormat, type DocumentLayer, type DocumentRect, type DocumentSource, EventBus, type EventCallback, type LoadOptions, type LoadedDocument, type PageInfo, type PageRect, type ScrollToRectOptions, type SearchMatch, type Size, type ViewerError, type ViewerErrorCode, type ViewerEvent, type ViewerEventCallback, type ViewerState, type ViewerStatus, ViewerStore, type ViewportMetrics, type ViewportRect, type ZoomMode, computeScrollTarget, computeVisiblePage, createError, detectFormat, projectRect, unionRects };
