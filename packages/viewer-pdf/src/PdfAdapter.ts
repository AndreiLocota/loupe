import {
  type AdapterCapabilities,
  type AdapterFactory,
  computeScrollTarget,
  createError,
  type DocumentAdapter,
  type DocumentAnnotation,
  type DocumentLayer,
  type DocumentRect,
  type DocumentSource,
  type LoadedDocument,
  type LoadOptions,
  type PageRect,
  type ScrollToRectOptions,
  type SearchMatch,
  type ViewportMetrics,
  type ZoomMode,
} from "@veridox-ai/loupe-core";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import {
  AnnotationMode,
  GlobalWorkerOptions,
  getDocument,
  Util,
} from "pdfjs-dist";
import {
  enumerateMatches,
  filterTextItems,
  type ItemSliceMatch,
  type StitchItem,
} from "./textStitch.js";

// OptionalContentConfig isn't re-exported from the package entry; derive it.
type OptionalContentConfig = Awaited<
  ReturnType<PDFDocumentProxy["getOptionalContentConfig"]>
>;

// Subset of pdf.js's (untyped) annotation objects that we surface as metadata.
interface RawPdfAnnotation {
  id?: string;
  subtype?: string;
  rect?: number[];
  titleObj?: { str?: string };
  contentsObj?: { str?: string };
  creationDate?: string | null;
  modificationDate?: string | null;
  color?: Uint8ClampedArray | null;
  url?: string;
  fieldName?: string;
  fieldValue?: unknown;
  oc?: { type?: string; id?: string };
}

function toHexColor(c?: Uint8ClampedArray | null): string | undefined {
  if (!c || c.length < 3) return undefined;
  const h = (n: number | undefined): string =>
    (n ?? 0).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

// Text-layer glyph metrics. We render the (invisible) selectable text in one
// generic font and correct each run's width with scaleX, so the exact family
// only needs to be consistent between measurement and rendering.
const TEXT_LAYER_FONT = "sans-serif";
const DEFAULT_ASCENT = 0.8;
const SEARCH_HIGHLIGHT_CLASS = "loupe-search-highlight";
const SEARCH_HIGHLIGHT_ACTIVE_CLASS = "loupe-search-highlight-active";
// Inline defaults so the library stays CSS-file-free; the classes exist so
// embedders can restyle (inline styles need `!important` to override).
const HIGHLIGHT_BASE_BACKGROUND = "rgba(255,212,0,0.45)";
const HIGHLIGHT_ACTIVE_BACKGROUND = "rgba(255,140,0,0.6)";
const HIGHLIGHT_ACTIVE_OUTLINE = "2px solid rgba(230,120,0,0.9)";
// Floor for the render scale so a not-yet-laid-out container (clientWidth 0) or a
// bogus numeric zoom can't produce a zero/negative canvas size.
const MIN_SCALE = 0.1;
let measureCtx: CanvasRenderingContext2D | null | undefined;
let cachedAscentRatio = 0;

function getTextMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

/** Ascent fraction of the line box for TEXT_LAYER_FONT (baseline placement). */
function getAscentRatio(ctx: CanvasRenderingContext2D): number {
  if (cachedAscentRatio) return cachedAscentRatio;
  ctx.font = `100px ${TEXT_LAYER_FONT}`;
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? 0;
  const descent = Math.abs(m.fontBoundingBoxDescent ?? 0);
  cachedAscentRatio =
    ascent && ascent + descent ? ascent / (ascent + descent) : DEFAULT_ASCENT;
  return cachedAscentRatio;
}

const WORKER_SRC = new URL("./workers/pdf.worker.js", import.meta.url).href;

const ALLOWED_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const CAPABILITIES: AdapterCapabilities = {
  pageCount: true,
  textSearch: true,
  textSelection: true,
  thumbnails: true,
  rotation: true,
  layers: true,
  annotations: true,
  viewport: true,
  scrollToRect: true,
};

interface PageSlot {
  pageNum: number;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  textLayerDiv: HTMLDivElement;
  rendered: boolean;
  viewport: PageViewport | null;
  // Monotonic counter: each render attempt bumps it so stale (superseded)
  // attempts bail before touching the canvas. Guards against overlapping
  // renders of the same page (e.g. double setZoom + IntersectionObserver).
  renderSeq: number;
  renderTask: { cancel(): void } | null;
  // Text items backing the rendered text layer, and each item's index into
  // the layer's spans (-1 for empty items, which get no span). Written by
  // renderTextLayer in the same pass that rebuilds the DOM so the two cannot
  // diverge; null until the text layer first renders.
  stitchItems: StitchItem[] | null;
  spanIndexByItem: number[] | null;
}

export class PdfAdapter implements DocumentAdapter {
  readonly capabilities = CAPABILITIES;

  private mountElement: HTMLElement | null = null;
  private scrollContainer: HTMLDivElement | null = null;
  private pdfDoc: PDFDocumentProxy | null = null;
  private loadingTask: { destroy: () => Promise<void> } | null = null;
  private defaultPageWidth = 612;
  private defaultPageHeight = 792;
  private pageSlots: PageSlot[] = [];
  private scale = 1.5;
  // Remembered so a fit mode can be re-applied when the container is resized
  // (or when its first laid-out size differs from the size at load time).
  private zoomMode: ZoomMode = "fit-width";
  private observer: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  // Tail of the thumbnail render chain (see getThumbnail).
  private thumbnailQueue: Promise<void> = Promise.resolve();
  private lastFitWidth = 0;
  private lastFitHeight = 0;
  private abortController = new AbortController();
  private loadedDoc: LoadedDocument | null = null;
  private ocConfig: OptionalContentConfig | null = null;
  private annotationsVisible = true;
  private rotation = 0;
  private searchMatches: { pageIndex: number; query: string }[] = [];
  private currentSearchQuery = "";
  // Yield-order index of the emphasised match (the store's active index).
  private activeMatchIndex: number | null = null;
  // Per-page native (un-rotated, scale-1) sizes; null until measured. Seeded
  // with page 1's size as an estimate so every slot can be pre-sized — see
  // applySlotSize.
  private pageNativeSizes: ({ w: number; h: number } | null)[] = [];
  // Resolves when the background measurement pass has replaced every estimate
  // with the real page size (or the load was torn down). Precise scrolling
  // awaits it so offsets are computed against settled layout.
  private layoutReady: Promise<void> = Promise.resolve();
  private resolveLayoutReady: () => void = () => {};
  private layoutSettled = false;
  // Latest goToPage target, so its one post-measurement correction can be
  // dropped when a newer navigation (page or rect) supersedes it.
  private lastNavPage: number | null = null;
  private workerSrc: string;
  private viewportCbs = new Set<() => void>();

  private fireViewport = (): void => {
    for (const cb of this.viewportCbs) cb();
  };

  constructor(workerSrc?: string) {
    this.workerSrc = workerSrc || WORKER_SRC;
  }

  async load(
    source: DocumentSource,
    mount: HTMLElement,
    opts: LoadOptions,
  ): Promise<LoadedDocument> {
    this.mountElement = mount;
    this.abortController = new AbortController();

    GlobalWorkerOptions.workerSrc = this.workerSrc;

    // Cancellation: if the caller's signal is already/becomes aborted at any
    // await boundary, tear down everything created so far and reject — otherwise
    // the parse/worker/observers keep running after the store has moved on.
    const ensureLive = (): void => {
      if (opts.signal?.aborted) {
        this.destroy();
        throw new DOMException("PDF load cancelled", "AbortError");
      }
    };

    const data =
      source.data instanceof ArrayBuffer
        ? { data: source.data }
        : { data: await (source.data as Blob).arrayBuffer() };
    ensureLive();

    const loadingTask = getDocument({
      ...data,
      ...(opts.password !== undefined ? { password: opts.password } : {}),
      disableAutoFetch: false,
    });
    this.loadingTask = loadingTask;
    try {
      this.pdfDoc = await loadingTask.promise;
    } catch (err) {
      // Surface password-protected PDFs as a typed, recoverable error instead of
      // leaking pdf.js's raw PasswordException.
      if ((err as Error)?.name === "PasswordException") {
        throw createError(
          "PASSWORD_REQUIRED",
          "This PDF is password-protected",
          { format: "pdf" },
        );
      }
      throw err;
    }
    ensureLive();

    const pageCount = this.pdfDoc.numPages;

    // Optional content groups (layers). Null for PDFs without an /OCProperties
    // dictionary; getLayers() then returns an empty list.
    try {
      this.ocConfig = await this.pdfDoc.getOptionalContentConfig();
    } catch {
      this.ocConfig = null;
    }
    ensureLive();

    // Load first page for dimensions estimate; rest load on-demand via observer
    let defaultWidth = 612;
    let defaultHeight = 792;
    try {
      const firstPage = await this.pdfDoc.getPage(1);
      const vp = firstPage.getViewport({ scale: 1 });
      defaultWidth = vp.width;
      defaultHeight = vp.height;
      this.defaultPageWidth = vp.width;
      this.defaultPageHeight = vp.height;
    } catch {
      /* use defaults */
    }

    const pages = Array.from({ length: pageCount }, (_, i) => ({
      index: i,
      dimensions: { width: defaultWidth, height: defaultHeight },
      rotation: 0,
    }));

    ensureLive();
    // Seed per-page sizes with the page-1 estimate; the background pass below
    // replaces estimates with real sizes and then resolves layoutReady.
    this.pageNativeSizes = Array.from({ length: pageCount }, () => null);
    this.pageNativeSizes[0] = { w: defaultWidth, h: defaultHeight };
    this.layoutSettled = false;
    this.layoutReady = new Promise<void>((resolve) => {
      this.resolveLayoutReady = resolve;
    });
    this.buildDom(pageCount);

    const initialPage = opts.initialPage ?? 1;
    const initialZoom = opts.initialZoom ?? "fit-width";
    this.setZoom(initialZoom);
    this.goToPage(initialPage);
    void this.measureAllPages();

    this.loadedDoc = { pageCount, pages };
    return this.loadedDoc;
  }

  destroy(): void {
    this.abortController.abort();
    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.pdfDoc) {
      this.pdfDoc.cleanup();
      this.pdfDoc = null;
    }
    if (this.loadingTask) {
      this.loadingTask.destroy();
      this.loadingTask = null;
    }

    for (const slot of this.pageSlots) {
      slot.container.remove();
    }
    this.pageSlots = [];
    this.clearSearchHighlights();

    if (this.scrollContainer) {
      this.scrollContainer.remove();
      this.scrollContainer = null;
    }
    this.mountElement = null;
    this.loadedDoc = null;
    this.ocConfig = null;
    this.activeMatchIndex = null;
    // Release anything awaiting settled layout — they re-check the (now null)
    // scroll container after the await and bail.
    this.layoutSettled = true;
    this.resolveLayoutReady();
  }

  getZoom(): number {
    return this.scale;
  }

  goToPage(n: number): void {
    const slot = this.pageSlots[n - 1];
    const sc = this.scrollContainer;
    if (!slot || !sc) return;
    this.lastNavPage = n;
    // Scroll the container itself rather than scrollIntoView, which can also
    // move ancestor scrollers. The 8px offset matches the slot margin.
    sc.scrollTo({ top: slot.container.offsetTop - 8, behavior: "smooth" });
    if (!this.layoutSettled) {
      // Offsets may still be page-1 estimates; snap once to the exact position
      // when measurement settles, unless a newer navigation superseded this.
      void this.layoutReady.then(() => {
        if (this.lastNavPage !== n || !this.scrollContainer) return;
        this.scrollContainer.scrollTo({
          top: slot.container.offsetTop - 8,
          behavior: "auto",
        });
      });
    }
  }

  async scrollToRect(
    pageIndex: number,
    rect: DocumentRect,
    opts: ScrollToRectOptions = {},
  ): Promise<void> {
    this.lastNavPage = null;
    // Wait for real page sizes so the target is computed against settled
    // offsets — no scroll-then-correct race on long documents.
    await this.layoutReady;
    const sc = this.scrollContainer;
    const metrics = this.getViewport();
    if (!sc || !metrics) return;
    const target = computeScrollTarget(
      metrics,
      pageIndex,
      rect,
      opts.align ?? "center",
    );
    if (!target) return;
    sc.scrollTo({
      left: target.left,
      top: target.top,
      behavior: opts.behavior ?? "smooth",
    });
  }

  setZoom(scale: ZoomMode): void {
    this.zoomMode = scale;
    // Measure the scroll viewport, not the mount: its clientWidth/Height already
    // exclude its own scrollbars, so fitting against it won't oscillate when a
    // scrollbar appears or disappears as a result of the fit.
    const fitBox = this.scrollContainer ?? this.mountElement;
    // At 90/270° the page's on-screen width/height are swapped, so fit against
    // the rotated dimensions.
    const rotated = this.rotation % 180 !== 0;
    const pageW = rotated ? this.defaultPageHeight : this.defaultPageWidth;
    const pageH = rotated ? this.defaultPageWidth : this.defaultPageHeight;
    if (typeof scale === "number") {
      this.scale = Math.max(MIN_SCALE, scale);
    } else if (
      scale === "fit-width" &&
      fitBox &&
      fitBox.clientWidth > 0 &&
      pageW > 0
    ) {
      // Fit against the UNSCALED page width. Using slot.viewport (already scaled
      // by the current zoom) would feed the current scale back into the formula.
      // Clamp: a not-yet-laid-out container (clientWidth 0) would otherwise yield
      // a negative scale, which makes canvas.width Uint32-wrap and throw.
      this.lastFitWidth = fitBox.clientWidth;
      this.scale = Math.max(MIN_SCALE, (fitBox.clientWidth - 32) / pageW);
    } else if (
      scale === "fit-page" &&
      fitBox &&
      fitBox.clientWidth > 0 &&
      fitBox.clientHeight > 0 &&
      pageH > 0
    ) {
      this.lastFitHeight = fitBox.clientHeight;
      this.scale = Math.max(MIN_SCALE, (fitBox.clientHeight - 32) / pageH);
    }
    // Keep every slot's box in step with the new scale/rotation — not just the
    // rendered ones — so offsets stay exact for pages that haven't rendered.
    this.applyAllSlotSizes();
    this.renderVisible();
    this.fireViewport();
  }

  /**
   * Pre-size a page container from its native (or page-1-estimated) size so
   * scroll offsets are correct before the page renders — unsized slots were
   * landing navigation pages short on long documents. renderPageSlot later
   * sets the same numbers, so rendering is a no-op resize.
   */
  private applySlotSize(i: number): void {
    const slot = this.pageSlots[i];
    if (!slot) return;
    const size = this.pageNativeSizes[i];
    const w = size?.w ?? this.defaultPageWidth;
    const h = size?.h ?? this.defaultPageHeight;
    const rotated = this.rotation % 180 !== 0;
    slot.container.style.width = (rotated ? h : w) * this.scale + "px";
    slot.container.style.height = (rotated ? w : h) * this.scale + "px";
  }

  private applyAllSlotSizes(): void {
    for (let i = 0; i < this.pageSlots.length; i++) this.applySlotSize(i);
  }

  /**
   * Resolve every page's native size in the background so container offsets
   * become exact for mixed-size documents, then resolve layoutReady (which
   * precise scrolling awaits). Runs after load(); estimates from page 1 are
   * already applied synchronously, so this only corrects the outliers.
   */
  private async measureAllPages(): Promise<void> {
    const doc = this.pdfDoc;
    const signal = this.abortController.signal;
    const settle = this.resolveLayoutReady;
    const isCurrent = (): boolean => !signal.aborted && this.pdfDoc === doc;
    try {
      if (!doc) return;
      for (let i = 0; i < this.pageSlots.length; i++) {
        if (!isCurrent()) return;
        if (this.pageNativeSizes[i]) continue;
        try {
          const page = await doc.getPage(i + 1);
          if (!isCurrent()) return;
          const vp = page.getViewport({ scale: 1, rotation: 0 });
          this.pageNativeSizes[i] = { w: vp.width, h: vp.height };
          this.applySlotSize(i);
        } catch {
          continue; // unmeasurable page keeps its estimate
        }
        // Yield periodically so a large document doesn't starve rendering.
        if (i % 20 === 19) await new Promise((r) => setTimeout(r));
      }
      if (isCurrent()) {
        this.layoutSettled = true;
        this.fireViewport();
      }
    } finally {
      // Resolve THIS load's promise even when superseded, so awaiters bail
      // (they re-check the scroll container) instead of hanging.
      settle();
    }
  }

  getViewport(): ViewportMetrics | null {
    const sc = this.scrollContainer;
    if (!sc) return null;
    const rotated = this.rotation % 180 !== 0;
    const pages: PageRect[] = this.pageSlots.map((slot) => {
      const w = slot.container.offsetWidth;
      const h = slot.container.offsetHeight;
      return {
        index: slot.pageNum - 1,
        x: slot.container.offsetLeft,
        y: slot.container.offsetTop,
        width: w,
        height: h,
        // Un-rotate to native points, un-scale to size at 100%.
        nativeWidth: (rotated ? h : w) / this.scale,
        nativeHeight: (rotated ? w : h) / this.scale,
      };
    });
    return {
      scale: this.scale,
      rotation: ((this.rotation % 360) + 360) % 360,
      scroll: { x: sc.scrollLeft, y: sc.scrollTop },
      content: { width: sc.scrollWidth, height: sc.scrollHeight },
      client: { width: sc.clientWidth, height: sc.clientHeight },
      devicePixelRatio:
        typeof window !== "undefined" && window.devicePixelRatio
          ? window.devicePixelRatio
          : 1,
      // PDF user space is 1/72 inch; a content pixel at scale 1 is one point.
      unit: "pt",
      pages,
    };
  }

  subscribeViewport(callback: () => void): () => void {
    this.viewportCbs.add(callback);
    return () => {
      this.viewportCbs.delete(callback);
    };
  }

  /**
   * One-shot text location for overlays (marks). A fresh scan that returns every
   * match's geometry; it never touches `searchMatches`, the current query, or
   * the DOM highlight layer, so it won't disturb the interactive search UI.
   * Bounds are native PDF points flipped to a top-left origin — the same
   * contract `search()` yields.
   */
  async findMatches(query: string): Promise<SearchMatch[]> {
    const q = query.trim();
    if (!this.pdfDoc || !q) return [];
    const out: SearchMatch[] = [];
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      if (this.abortController.signal.aborted) break;
      const page = await this.pdfDoc.getPage(pageNum);
      // Native page height (points) to flip PDF's bottom-left origin to the
      // top-left, native-units convention findMatches returns everywhere.
      const nativeH = page.getViewport({ scale: 1 }).height;
      const tc = await page.getTextContent();
      const items = filterTextItems(tc.items);
      for (const match of enumerateMatches(items, q)) {
        out.push({
          pageIndex: pageNum - 1,
          text: match.text,
          bounds: this.sliceBounds(items, match, nativeH),
        });
      }
    }
    return out;
  }

  /** One rect per item slice — a match spanning a style change or a line
   * break paints one box per item it crosses. */
  private sliceBounds(
    items: readonly StitchItem[],
    match: ItemSliceMatch,
    nativeH: number,
  ): DocumentRect[] {
    const rects: DocumentRect[] = [];
    for (const slice of match.slices) {
      const item = items[slice.itemIndex];
      if (!item) continue;
      rects.push(
        this.matchBounds(item, slice.start, slice.end - slice.start, nativeH),
      );
    }
    return rects;
  }

  /**
   * Narrow a text run's box to just the matched substring, proportionally
   * (text-content items can span a whole line, so the full run reads as a
   * wildly over-wide highlight). Approximate for proportional fonts, but far
   * tighter than the whole run. Native PDF points, flipped from the PDF's
   * bottom-left origin to top-left via the page height.
   */
  private matchBounds(
    item: { str: string; width: number; height: number; transform: number[] },
    idx: number,
    queryLen: number,
    nativeH: number,
  ): DocumentRect {
    const len = item.str.length || 1;
    const originX = item.transform[4] ?? 0;
    const baselineY = item.transform[5] ?? 0;
    return {
      x: originX + (item.width * idx) / len,
      // baseline + font height ≈ glyph top in bottom-left space.
      y: nativeH - (baselineY + item.height),
      width: (item.width * queryLen) / len,
      height: item.height,
    };
  }

  search(query: string) {
    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentSearchQuery = query;
    this.activeMatchIndex = null;

    if (!this.pdfDoc || !query.trim()) {
      return createAsyncIterable([]);
    }

    const self = this as PdfAdapter;
    const pdfDoc = this.pdfDoc;
    return {
      [Symbol.asyncIterator]() {
        let pageNum = 1;
        let items: StitchItem[] = [];
        let pageMatches: ItemSliceMatch[] = [];
        let matchIdx = 0;
        let loaded = false;
        let nativeH = 0;
        let done = false;

        return {
          async next(): Promise<IteratorResult<SearchMatch>> {
            while (!done) {
              // Load next page if needed
              if (!loaded && pageNum <= pdfDoc.numPages) {
                const page = await pdfDoc.getPage(pageNum);
                // Native height flips PDF's bottom-left origin to top-left.
                nativeH = page.getViewport({ scale: 1 }).height;
                const tc = await page.getTextContent();
                // Matching runs over the page's stitched text, so a phrase
                // spanning a style change or line break is one match. One
                // searchMatches entry per match — a wrapped match paints two
                // boxes (see dataset.loupeMatch) but counts once.
                items = filterTextItems(tc.items);
                pageMatches = enumerateMatches(items, query);
                matchIdx = 0;
                loaded = true;
              }

              const match = pageMatches[matchIdx];
              if (match) {
                matchIdx++;
                self.searchMatches.push({ pageIndex: pageNum - 1, query });
                return {
                  value: {
                    pageIndex: pageNum - 1,
                    text: match.text,
                    bounds: self.sliceBounds(items, match, nativeH),
                  },
                  done: false,
                };
              }

              // Move to next page
              pageNum++;
              loaded = false;
              items = [];
              pageMatches = [];
              if (pageNum > pdfDoc.numPages) {
                done = true;
                self.highlightCurrentSearch();
              }
            }

            return { value: undefined as unknown as SearchMatch, done: true };
          },
        };
      },
    };
  }

  clearSearch(): void {
    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentSearchQuery = "";
    this.activeMatchIndex = null;
  }

  /**
   * Emphasise one match of the current search by its position in `search()`'s
   * yield order (the store's active index), or `null` to clear the emphasis.
   * Pages that render later pick the emphasis up in highlightSlot.
   */
  setActiveSearchMatch(index: number | null): void {
    this.activeMatchIndex = index;
    for (const slot of this.pageSlots) this.applyActiveStyle(slot);
  }

  async getThumbnail(page: number, maxPx: number): Promise<ImageBitmap> {
    if (!this.pdfDoc) throw new Error("No document loaded");

    // Serialize thumbnail renders: a consumer mounting one request per page
    // (e.g. a thumbnail rail) would otherwise fire N concurrent PDF.js render
    // tasks that compete with the visible page render. Each call chains onto
    // the previous one; failures don't poison the queue.
    const run = this.thumbnailQueue.then(() =>
      this.renderThumbnail(page, maxPx),
    );
    this.thumbnailQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async renderThumbnail(
    page: number,
    maxPx: number,
  ): Promise<ImageBitmap> {
    if (!this.pdfDoc) throw new Error("No document loaded");

    const pdfPage = await this.pdfDoc.getPage(page);
    const vp = pdfPage.getViewport({ scale: 1, rotation: this.rotation });
    const thumbScale = maxPx / Math.max(vp.width, vp.height);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width * thumbScale);
    canvas.height = Math.round(vp.height * thumbScale);

    await pdfPage.render({
      canvas,
      viewport: pdfPage.getViewport({
        scale: thumbScale,
        rotation: this.rotation,
      }),
      annotationMode: this.annotationsVisible
        ? AnnotationMode.ENABLE
        : AnnotationMode.DISABLE,
      ...(this.ocConfig
        ? { optionalContentConfigPromise: Promise.resolve(this.ocConfig) }
        : {}),
    }).promise;

    return createImageBitmap(canvas);
  }

  getLayers(): DocumentLayer[] {
    if (!this.ocConfig) return [];
    const layers: DocumentLayer[] = [];
    // OptionalContentConfig is iterable as [id, group] entries.
    for (const [id, group] of this.ocConfig as Iterable<
      [string, { name?: string | null; visible: boolean }]
    >) {
      layers.push({ id, name: group.name || id, visible: group.visible });
    }
    return layers;
  }

  setLayerVisibility(id: string, visible: boolean): void {
    if (!this.ocConfig) return;
    this.ocConfig.setVisibility(id, visible);
    // Re-render currently visible pages with the updated configuration.
    this.renderVisible();
  }

  getAnnotationsVisible(): boolean {
    return this.annotationsVisible;
  }

  setAnnotationsVisible(visible: boolean): void {
    if (this.annotationsVisible === visible) return;
    this.annotationsVisible = visible;
    // Re-render visible pages: this re-bakes (or drops) annotation appearances
    // and rebuilds the text/link layer with the new setting.
    this.renderVisible();
  }

  getRotation(): number {
    return this.rotation;
  }

  setRotation(degrees: number): void {
    const normalized = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
    if (normalized === this.rotation) return;
    this.rotation = normalized;
    // Re-fit (rotation swaps page width/height) and re-render at the new angle.
    this.setZoom(this.zoomMode);
  }

  async getAnnotations(): Promise<DocumentAnnotation[]> {
    if (!this.pdfDoc) return [];
    const out: DocumentAnnotation[] = [];
    for (let p = 1; p <= this.pdfDoc.numPages; p++) {
      const page = await this.pdfDoc.getPage(p);
      const raw = (await page.getAnnotations()) as RawPdfAnnotation[];
      for (const a of raw) {
        // Skip pop-ups: they are UI attachments to a parent markup annotation,
        // not standalone content, and clutter a forensic listing.
        if (a.subtype === "Popup") continue;

        const ann: DocumentAnnotation = {
          id: String(a.id ?? `${p}-${out.length}`),
          pageIndex: p - 1,
          subtype: a.subtype ?? "Unknown",
          rect: [
            a.rect?.[0] ?? 0,
            a.rect?.[1] ?? 0,
            a.rect?.[2] ?? 0,
            a.rect?.[3] ?? 0,
          ],
        };

        const author = a.titleObj?.str?.trim();
        if (author) ann.author = author;
        const contents = a.contentsObj?.str?.trim();
        if (contents) ann.contents = contents;
        if (a.creationDate) ann.created = a.creationDate;
        if (a.modificationDate) ann.modified = a.modificationDate;
        const color = toHexColor(a.color);
        if (color) ann.color = color;
        if (a.url) ann.url = a.url;
        if (a.fieldName) ann.fieldName = a.fieldName;
        if (a.fieldValue != null && a.fieldValue !== "") {
          ann.fieldValue = String(a.fieldValue);
        }
        if (a.oc?.id) ann.layerId = a.oc.id;

        out.push(ann);
      }
    }
    return out;
  }

  private buildDom(pageCount: number): void {
    if (!this.mountElement) return;

    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "loupe-pdf-scroll";
    this.scrollContainer.style.cssText =
      "overflow:auto;width:100%;height:100%;position:relative;";
    // Notify viewport subscribers (rulers/guides) as the content scrolls.
    this.scrollContainer.addEventListener("scroll", this.fireViewport, {
      passive: true,
      signal: this.abortController.signal,
    });

    this.mountElement.innerHTML = "";
    this.mountElement.appendChild(this.scrollContainer);

    this.pageSlots = [];
    for (let i = 0; i < pageCount; i++) {
      const container = document.createElement("div");
      container.className = "loupe-pdf-page";
      container.style.cssText =
        "position:relative;margin:8px auto;overflow:hidden;";
      container.dataset.pageNum = String(i + 1);

      const canvas = document.createElement("canvas");
      container.appendChild(canvas);

      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "loupe-pdf-text-layer";
      // pointer-events must be enabled for the transparent text spans to be
      // drag-selectable (and for link overlays to be clickable). It sits above
      // the canvas, which needs no interaction of its own.
      textLayerDiv.style.cssText =
        "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:auto;user-select:text;cursor:text;";
      container.appendChild(textLayerDiv);

      if (this.scrollContainer) {
        this.scrollContainer.appendChild(container);
      }

      this.pageSlots.push({
        pageNum: i + 1,
        container,
        canvas,
        textLayerDiv,
        rendered: false,
        viewport: null,
        renderSeq: 0,
        renderTask: null,
        stitchItems: null,
        spanIndexByItem: null,
      });
      // Size the slot immediately (estimate or cached real size) so offsets
      // are meaningful before anything renders.
      this.applySlotSize(i);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const slot = this.pageSlots.find(
              (s) => s.container === entry.target,
            );
            if (slot && !slot.rendered) {
              this.renderPageSlot(slot);
            }
          }
        }
      },
      { root: this.scrollContainer, rootMargin: "200px 0px" },
    );

    for (const slot of this.pageSlots) {
      this.observer.observe(slot.container);
    }

    // Re-apply the active fit mode when the container is (re)sized. This also
    // corrects the initial render: at load() time the mount may not be fully
    // laid out, so its clientWidth is wrong — the first ResizeObserver callback
    // fires with the settled size and re-fits.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        // Client size changed — rulers/guides must re-measure regardless of mode.
        this.fireViewport();
        if (typeof this.zoomMode === "number") return;
        const box = this.scrollContainer;
        if (!box) return;
        const w = box.clientWidth;
        const h = box.clientHeight;
        const changed =
          this.zoomMode === "fit-width"
            ? w !== this.lastFitWidth
            : h !== this.lastFitHeight;
        if (w > 0 && changed) {
          this.setZoom(this.zoomMode);
        }
      });
      this.resizeObserver.observe(this.scrollContainer);
    }
  }

  private async renderPageSlot(slot: PageSlot): Promise<void> {
    if (!this.pdfDoc) return;

    // Supersede any in-flight render of this slot so a stale attempt can't size
    // the canvas or draw after a newer one (which produced the top-left-corner
    // clipping when two renders of page 1 overlapped during load).
    const seq = ++slot.renderSeq;
    slot.renderTask?.cancel();
    slot.renderTask = null;
    slot.rendered = true;

    const signal = this.abortController.signal;

    try {
      const page = await this.pdfDoc.getPage(slot.pageNum);
      if (seq !== slot.renderSeq || signal.aborted) return; // superseded

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({
        scale: this.scale * dpr,
        rotation: this.rotation,
      });
      const logicalViewport = page.getViewport({
        scale: this.scale,
        rotation: this.rotation,
      });
      slot.viewport = logicalViewport;

      // Backing store in device pixels; CSS box in logical pixels.
      slot.canvas.width = viewport.width;
      slot.canvas.height = viewport.height;
      slot.container.style.width = logicalViewport.width + "px";
      slot.container.style.height = logicalViewport.height + "px";
      slot.canvas.style.width = logicalViewport.width + "px";
      slot.canvas.style.height = logicalViewport.height + "px";
      // Page geometry is now settled — refresh any ruler/guide overlay.
      this.fireViewport();

      const renderTask = page.render({
        canvas: slot.canvas,
        viewport,
        // Bake annotation appearances (markup, static form fields) into the
        // canvas only when the annotation layer is enabled. Links are handled
        // separately as a DOM overlay in renderTextLayer.
        annotationMode: this.annotationsVisible
          ? AnnotationMode.ENABLE
          : AnnotationMode.DISABLE,
        ...(this.ocConfig
          ? { optionalContentConfigPromise: Promise.resolve(this.ocConfig) }
          : {}),
      });
      slot.renderTask = renderTask;
      const onAbort = (): void => renderTask.cancel();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        await renderTask.promise;
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (slot.renderTask === renderTask) slot.renderTask = null;
      }

      if (seq !== slot.renderSeq || signal.aborted) return; // superseded during draw
      await this.renderTextLayer(page, logicalViewport, slot);
      // Re-apply search highlights: the text layer was just rebuilt (which also
      // dropped any prior highlight boxes), so pages rendered/re-rendered after
      // a search — e.g. scrolled into view or re-zoomed — still get highlighted.
      if (this.currentSearchQuery) this.highlightSlot(slot);
    } catch (err) {
      const name = (err as Error).name;
      if (name !== "AbortError" && name !== "RenderingCancelledException") {
        console.error("Failed to render page", slot.pageNum, err);
      }
    }
  }

  private async renderTextLayer(
    page: PDFPageProxy,
    viewport: PageViewport,
    slot: PageSlot,
  ): Promise<void> {
    const textContent = await page.getTextContent();
    slot.textLayerDiv.innerHTML = "";

    // Cache the filtered items and the item→span mapping alongside the DOM
    // rebuild so highlightSlot (which is sync) can enumerate stitched matches
    // against exactly the items these spans were built from.
    const stitchItems = filterTextItems(textContent.items);
    const spanIndexByItem: number[] = Array(stitchItems.length).fill(-1);
    slot.stitchItems = stitchItems;
    slot.spanIndexByItem = spanIndexByItem;
    let spanCount = 0;

    // Mirror pdf.js's text-layer geometry so the transparent, selectable spans
    // line up with the glyphs painted on the canvas: position each run at
    // (baseline − ascent), then stretch it horizontally with scaleX so its
    // width matches the PDF's advance width (our generic font renders at a
    // different width than the embedded font).
    const ctx = getTextMeasureCtx();
    const ascentRatio = ctx ? getAscentRatio(ctx) : DEFAULT_ASCENT;

    for (let itemIndex = 0; itemIndex < stitchItems.length; itemIndex++) {
      const item = stitchItems[itemIndex];
      if (!item || item.str === "") continue;
      spanIndexByItem[itemIndex] = spanCount++;

      const tx = Util.transform(viewport.transform, item.transform);
      const angle = Math.atan2(tx[1], tx[0]);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      const fontAscent = fontHeight * ascentRatio;

      // Anchor is the top-left of the run; offset up from the baseline by the
      // ascent (rotated when the run isn't horizontal).
      const left = angle === 0 ? tx[4] : tx[4] + fontAscent * Math.sin(angle);
      const top =
        angle === 0 ? tx[5] - fontAscent : tx[5] - fontAscent * Math.cos(angle);

      let scaleX = 1;
      if (ctx && item.width > 0) {
        ctx.font = `${fontHeight}px ${TEXT_LAYER_FONT}`;
        const measured = ctx.measureText(item.str).width;
        if (measured > 0) scaleX = (item.width * viewport.scale) / measured;
      }

      const span = document.createElement("span");
      span.textContent = item.str;
      span.style.cssText =
        `position:absolute;left:${left}px;top:${top}px;` +
        `font-size:${fontHeight}px;font-family:${TEXT_LAYER_FONT};line-height:1;` +
        `white-space:pre;color:transparent;cursor:text;transform-origin:0 0;` +
        `transform:rotate(${angle}rad) scaleX(${scaleX});`;

      slot.textLayerDiv.appendChild(span);
    }

    // Link overlays are part of the annotation layer — skip them when hidden.
    if (!this.annotationsVisible) return;
    const annotations = await page.getAnnotations();
    for (const annot of annotations) {
      if (annot.subtype === "Link" && annot.url) {
        this.handlePdfLink(annot, viewport, slot);
      }
    }
  }

  private handlePdfLink(
    annot: { url?: string; rect?: number[]; subtype?: string },
    viewport: PageViewport,
    slot: PageSlot,
  ): void {
    const url = annot.url || "";
    if (!url) return;

    let protocol = "";
    try {
      protocol = new URL(url).protocol;
    } catch {
      return;
    }
    if (!ALLOWED_LINK_SCHEMES.has(protocol)) return;

    const rect = annot.rect || [0, 0, 0, 0];
    const tx = viewport.transform as number[];
    const t0 = tx[0] ?? 0,
      t1 = tx[1] ?? 0,
      t2 = tx[2] ?? 0,
      t3 = tx[3] ?? 0,
      t4 = tx[4] ?? 0,
      t5 = tx[5] ?? 0;
    const left = t0 * (rect[0] ?? 0) + t2 * (rect[1] ?? 0) + t4;
    const top = t1 * (rect[0] ?? 0) + t3 * (rect[1] ?? 0) + t5;
    const right = t0 * (rect[2] ?? 0) + t2 * (rect[3] ?? 0) + t4;
    const bottom = t1 * (rect[2] ?? 0) + t3 * (rect[3] ?? 0) + t5;

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText =
      `position:absolute;left:${left}px;top:${Math.min(top, bottom)}px;` +
      `width:${right - left}px;height:${Math.abs(bottom - top)}px;cursor:pointer;`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    slot.textLayerDiv.appendChild(link);
  }

  private renderVisible(): void {
    for (const slot of this.pageSlots) {
      slot.rendered = false;
    }
    for (const slot of this.pageSlots) {
      const rect = slot.container.getBoundingClientRect();
      const scrollRect = this.scrollContainer?.getBoundingClientRect();
      if (!scrollRect) continue;
      if (
        rect.bottom >= scrollRect.top - 200 &&
        rect.top <= scrollRect.bottom + 200
      ) {
        this.renderPageSlot(slot);
      }
    }
  }

  private clearSearchHighlights(): void {
    // Overlay boxes are tagged with a class; the text spans are never touched.
    for (const slot of this.pageSlots) {
      slot.textLayerDiv
        .querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`)
        .forEach((el) => el.remove());
    }
  }

  private highlightCurrentSearch(): void {
    this.clearSearchHighlights();
    if (!this.currentSearchQuery) return;
    // Dedupe by page (searchMatches has one entry per occurrence). Only pages
    // that are currently rendered have a text layer to highlight; the rest are
    // handled by renderPageSlot as they render in.
    const pages = new Set(this.searchMatches.map((m) => m.pageIndex));
    for (const pageIndex of pages) {
      const slot = this.pageSlots[pageIndex];
      if (slot) this.highlightSlot(slot);
    }
  }

  /**
   * Draw substring highlight boxes for the active query onto one page's text
   * layer. Uses a DOM Range per occurrence so getClientRects() reflects the
   * span's scaleX transform and the boxes line up with the rendered glyphs.
   */
  private highlightSlot(slot: PageSlot): void {
    slot.textLayerDiv
      .querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`)
      .forEach((el) => el.remove());
    const query = this.currentSearchQuery;
    if (!query) return;
    const { stitchItems, spanIndexByItem } = slot;
    // No text layer yet: renderPageSlot highlights after it builds, and
    // highlightCurrentSearch repaints matched pages when a search completes.
    if (!stitchItems || !spanIndexByItem) return;

    // Number each occurrence with its global (document-wide) match ordinal so
    // the active match can be singled out. `searchMatches` records one entry
    // per occurrence in yield order (page-ascending), so this page's first
    // occurrence sits after every match on earlier pages. A page painted while
    // the search iterator is still mid-flight can carry provisional ordinals;
    // highlightCurrentSearch repaints every matched page on completion, and
    // the store only sets the active index after committing, so no active box
    // is ever mis-tagged.
    const base = this.searchMatches.filter(
      (m) => m.pageIndex < slot.pageNum - 1,
    ).length;

    const layerRect = slot.textLayerDiv.getBoundingClientRect();
    const spans = Array.from(slot.textLayerDiv.querySelectorAll("span"));
    // Same enumeration as search()/findMatches(), so painted occurrences stay
    // one-to-one with counted matches. Every box of one match shares one
    // ordinal: a match wrapping a line paints a box per slice but counts (and
    // activates) as one.
    const matches = enumerateMatches(stitchItems, query);
    for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
      const ordinal = base + matchIdx;
      for (const slice of matches[matchIdx]?.slices ?? []) {
        const spanIdx = spanIndexByItem[slice.itemIndex] ?? -1;
        const textNode = spanIdx >= 0 ? spans[spanIdx]?.firstChild : null;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
        const range = document.createRange();
        range.setStart(textNode, slice.start);
        range.setEnd(textNode, slice.end);
        for (const rect of range.getClientRects()) {
          const box = document.createElement("div");
          box.className = SEARCH_HIGHLIGHT_CLASS;
          box.dataset.loupeMatch = String(ordinal);
          box.style.cssText =
            `position:absolute;pointer-events:none;background:${HIGHLIGHT_BASE_BACKGROUND};` +
            `left:${rect.left - layerRect.left}px;top:${rect.top - layerRect.top}px;` +
            `width:${rect.width}px;height:${rect.height}px;`;
          slot.textLayerDiv.appendChild(box);
        }
      }
    }

    this.applyActiveStyle(slot);
  }

  /** Toggle the active-match emphasis on one page's highlight boxes. */
  private applyActiveStyle(slot: PageSlot): void {
    const active = this.activeMatchIndex;
    const boxes = slot.textLayerDiv.querySelectorAll<HTMLElement>(
      `.${SEARCH_HIGHLIGHT_CLASS}`,
    );
    for (const box of boxes) {
      const isActive =
        active !== null && box.dataset.loupeMatch === String(active);
      box.classList.toggle(SEARCH_HIGHLIGHT_ACTIVE_CLASS, isActive);
      box.style.background = isActive
        ? HIGHLIGHT_ACTIVE_BACKGROUND
        : HIGHLIGHT_BASE_BACKGROUND;
      box.style.outline = isActive ? HIGHLIGHT_ACTIVE_OUTLINE : "";
    }
  }
}

export function createPdfAdapterFactory(workerSrc?: string): AdapterFactory {
  return {
    format: "pdf",
    capabilities: CAPABILITIES,
    create: () => new PdfAdapter(workerSrc),
  };
}

function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next(): Promise<IteratorResult<T>> {
          const value = items[i];
          if (i < items.length && value !== undefined) {
            i++;
            return { value, done: false };
          }
          return { value: undefined as unknown as T, done: true };
        },
      };
    },
  };
}
