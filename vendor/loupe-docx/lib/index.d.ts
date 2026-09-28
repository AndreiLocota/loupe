import { DocumentAdapter, AdapterCapabilities, DocumentSource, LoadOptions, LoadedDocument, ZoomMode, ViewportMetrics, SearchMatch, DocumentRect, ScrollToRectOptions, AdapterFactory } from '@veridox-ai/loupe-core';

interface DocxAdapterOptions {
    /**
     * Enable page-thumbnail generation. Off by default; opt in when a thumbnail
     * rail is wanted for multi-page documents.
     */
    thumbnails?: boolean;
    /**
     * @deprecated No-op since 3.0.0: DOCX no longer renders inside an iframe,
     * so there is no render script to host. Accepted for compile compatibility;
     * will be removed in 4.0.
     */
    iframeScriptUrl?: string;
    /**
     * URL of the rendering engine's WASM binary. Only needed when the consuming
     * bundler can't resolve `new URL(..., import.meta.url)` assets from
     * @silurus/ooxml (e.g. plain esbuild) — copy the engine's .wasm from its
     * dist and point this at it.
     */
    wasmUrl?: string;
}
declare class DocxAdapter implements DocumentAdapter {
    readonly capabilities: AdapterCapabilities;
    private thumbnailsEnabled;
    private wasmUrl;
    private doc;
    private viewer;
    private container;
    private scroller;
    private nativeSizes;
    private loadedDoc;
    private currentZoom;
    private viewportCbs;
    private resizeObserver;
    private scrollListener;
    private generation;
    private runsCache;
    private measureForFont;
    private activeQuery;
    private engineCursor;
    private matchCount;
    private searchSeq;
    private activateSeq;
    private activationChain;
    private pendingFinds;
    private activeLoad;
    constructor(options?: DocxAdapterOptions);
    load(source: DocumentSource, mount: HTMLElement, opts: LoadOptions): Promise<LoadedDocument>;
    private runLoad;
    destroy(): void;
    private teardownDocument;
    setZoom(scale: ZoomMode): void;
    getZoom(): number;
    /** The engine's scroll host, resolved lazily: it is created and styled by
     * the viewer after mount, so the first load-time probe can miss it. Cached
     * once a real (non-fallback) host is found. */
    private getScroller;
    getViewport(): ViewportMetrics | null;
    subscribeViewport(callback: () => void): () => void;
    private notifyViewport;
    goToPage?(n: number): void;
    /**
     * One-shot text location. Enumerated locally from the engine's per-page text
     * runs (never through the viewer's find), so interactive search state and
     * on-screen highlights are untouched. Bounds are in the page's native
     * (un-zoomed) CSS pixels, top-left origin — the same space
     * {@link getViewport} reports.
     */
    findMatches(query: string): Promise<SearchMatch[]>;
    /**
     * Interactive search. The engine enumerates every occurrence (the same
     * enumeration that paints the highlights, so the yielded count and the marks
     * on screen always agree); geometry is attached from a local scan of the
     * same text runs, paired by per-page ordinal. Settles empty on
     * timeout/teardown.
     */
    search(query: string): AsyncIterable<SearchMatch>;
    private runInteractiveSearch;
    /** Pair the engine's matches (no geometry) with a local enumeration of the
     * same runs by per-page ordinal. Both scans use identical fold/scan
     * semantics, so ordinals line up; if they ever diverge the match degrades to
     * empty bounds (consumers then skip navigation) rather than mis-anchoring. */
    private attachBounds;
    private enumerateAllPages;
    /** Text runs for a page in native (scale-1) CSS px, cached per document. */
    private pageRuns;
    private raceFind;
    clearSearch?(): void;
    /** Emphasise one match of the current search by its position in search()'s
     * yield order; `null` re-runs the query, which resets the engine cursor and
     * repaints every highlight as passive. The engine only exposes cursor
     * stepping, so walk it the shorter way round. Activations are serialised and
     * the tracked cursor advances from the ordinal the engine actually returns
     * per completed step, so a superseding activation computes its path from
     * where a cancelled walk really stopped. Each engine step scrolls to the
     * match's page top on its own, so the returned promise (resolving when this
     * activation's walk has finished or been superseded) is what lets the store
     * order its precise scroll-to-match after the engine has gone quiet. */
    setActiveSearchMatch(index: number | null): Promise<void>;
    private runActivation;
    /** Scroll so `rect` (native units, top-left origin) on `pageIndex` is
     * visible, with the core's align/centre semantics. */
    scrollToRect(pageIndex: number, rect: DocumentRect, opts?: ScrollToRectOptions): Promise<void>;
    getThumbnail(page: number, maxPx: number): Promise<ImageBitmap>;
    /** External links are filtered to http/https/mailto and relayed to the host
     * as a `link-click` window message (never navigated — same contract as the
     * pre-3.0 iframe relay). Internal bookmark links scroll within the document. */
    private handleHyperlink;
}
declare function createDocxAdapterFactory(options?: DocxAdapterOptions): AdapterFactory;

export { DocxAdapter, createDocxAdapterFactory };
