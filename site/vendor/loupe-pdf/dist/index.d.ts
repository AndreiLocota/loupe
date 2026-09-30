import { DocumentAdapter, AdapterCapabilities, DocumentSource, LoadOptions, LoadedDocument, DocumentRect, ScrollToRectOptions, ZoomMode, ViewportMetrics, SearchMatch, DocumentLayer, DocumentAnnotation, AdapterFactory } from '@veridox-ai/loupe-core';

declare class PdfAdapter implements DocumentAdapter {
    readonly capabilities: AdapterCapabilities;
    private mountElement;
    private scrollContainer;
    private pdfDoc;
    private loadingTask;
    private defaultPageWidth;
    private defaultPageHeight;
    private pageSlots;
    private scale;
    private zoomMode;
    private observer;
    private resizeObserver;
    private thumbnailQueue;
    private lastFitWidth;
    private lastFitHeight;
    private abortController;
    private loadedDoc;
    private ocConfig;
    private annotationsVisible;
    private rotation;
    private searchMatches;
    private currentSearchQuery;
    private activeMatchIndex;
    private pageNativeSizes;
    private layoutReady;
    private resolveLayoutReady;
    private layoutSettled;
    private lastNavPage;
    private workerSrc;
    private viewportCbs;
    private fireViewport;
    constructor(workerSrc?: string);
    load(source: DocumentSource, mount: HTMLElement, opts: LoadOptions): Promise<LoadedDocument>;
    destroy(): void;
    getZoom(): number;
    goToPage(n: number): void;
    scrollToRect(pageIndex: number, rect: DocumentRect, opts?: ScrollToRectOptions): Promise<void>;
    setZoom(scale: ZoomMode): void;
    /**
     * Pre-size a page container from its native (or page-1-estimated) size so
     * scroll offsets are correct before the page renders — unsized slots were
     * landing navigation pages short on long documents. renderPageSlot later
     * sets the same numbers, so rendering is a no-op resize.
     */
    private applySlotSize;
    private applyAllSlotSizes;
    /**
     * Resolve every page's native size in the background so container offsets
     * become exact for mixed-size documents, then resolve layoutReady (which
     * precise scrolling awaits). Runs after load(); estimates from page 1 are
     * already applied synchronously, so this only corrects the outliers.
     */
    private measureAllPages;
    getViewport(): ViewportMetrics | null;
    subscribeViewport(callback: () => void): () => void;
    /**
     * One-shot text location for overlays (marks). A fresh scan that returns every
     * match's geometry; it never touches `searchMatches`, the current query, or
     * the DOM highlight layer, so it won't disturb the interactive search UI.
     * Bounds are native PDF points flipped to a top-left origin — the same
     * contract `search()` yields.
     */
    findMatches(query: string): Promise<SearchMatch[]>;
    /** One rect per item slice — a match spanning a style change or a line
     * break paints one box per item it crosses. */
    private sliceBounds;
    /**
     * Narrow a text run's box to just the matched substring, proportionally
     * (text-content items can span a whole line, so the full run reads as a
     * wildly over-wide highlight). Approximate for proportional fonts, but far
     * tighter than the whole run. Native PDF points, flipped from the PDF's
     * bottom-left origin to top-left via the page height.
     */
    private matchBounds;
    search(query: string): AsyncIterable<never> | {
        [Symbol.asyncIterator](): {
            next(): Promise<IteratorResult<SearchMatch>>;
        };
    };
    clearSearch(): void;
    /**
     * Emphasise one match of the current search by its position in `search()`'s
     * yield order (the store's active index), or `null` to clear the emphasis.
     * Pages that render later pick the emphasis up in highlightSlot.
     */
    setActiveSearchMatch(index: number | null): void;
    getThumbnail(page: number, maxPx: number): Promise<ImageBitmap>;
    private renderThumbnail;
    getLayers(): DocumentLayer[];
    setLayerVisibility(id: string, visible: boolean): void;
    getAnnotationsVisible(): boolean;
    setAnnotationsVisible(visible: boolean): void;
    getRotation(): number;
    setRotation(degrees: number): void;
    getAnnotations(): Promise<DocumentAnnotation[]>;
    private buildDom;
    private renderPageSlot;
    private renderTextLayer;
    private handlePdfLink;
    private renderVisible;
    private clearSearchHighlights;
    private highlightCurrentSearch;
    /**
     * Draw substring highlight boxes for the active query onto one page's text
     * layer. Uses a DOM Range per occurrence so getClientRects() reflects the
     * span's scaleX transform and the boxes line up with the rendered glyphs.
     */
    private highlightSlot;
    /** Toggle the active-match emphasis on one page's highlight boxes. */
    private applyActiveStyle;
}
declare function createPdfAdapterFactory(workerSrc?: string): AdapterFactory;

export { PdfAdapter, createPdfAdapterFactory };
