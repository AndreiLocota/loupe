import {
  type AdapterCapabilities,
  type AdapterFactory,
  computeScrollTarget,
  createError,
  type DocumentAdapter,
  type DocumentRect,
  type DocumentSource,
  type LoadedDocument,
  type LoadOptions,
  type ScrollToRectOptions,
  type SearchMatch,
  type Size,
  type ViewportMetrics,
  type ZoomMode,
} from "@veridox-ai/loupe-core";
import {
  DocxDocument,
  DocxScrollViewer,
  type DocxMatchLocation,
  type DocxTextRunInfo,
  type FindMatch,
  type HyperlinkTarget,
} from "@silurus/ooxml/docx";
import { toDocxViewerError } from "./errors.js";
import {
  computeViewportMetrics,
  findScrollHost,
  PT_TO_PX,
  VIEWER_LAYOUT,
} from "./geometry.js";
import { normalizeLinkTarget } from "./links.js";
import {
  createMeasureForFont,
  enumerateMatches,
  sliceBounds,
} from "./textMatch.js";
import { validateZip } from "./zipHygiene.js";

// Upper bound on the accepted page count, so a pathological document can't
// drive per-page allocations (page sizes, rects) into huge memory.
const MAX_DOCX_PAGES = 10000;
const DOCX_RENDER_TIMEOUT = 30000;
const FIND_TIMEOUT = 8000;
const THUMBNAIL_TIMEOUT = 15000;

const BASE_CAPABILITIES: AdapterCapabilities = {
  pageCount: true,
  textSearch: true,
  textSelection: true,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: true,
};

export interface DocxAdapterOptions {
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

function capabilitiesFor(options: DocxAdapterOptions): AdapterCapabilities {
  return { ...BASE_CAPABILITIES, thumbnails: options.thumbnails ?? false };
}

type ScrollViewer = Omit<DocxScrollViewer, "load">;

export class DocxAdapter implements DocumentAdapter {
  readonly capabilities: AdapterCapabilities;

  private thumbnailsEnabled: boolean;
  private wasmUrl: string | undefined;
  private doc: DocxDocument | null = null;
  private viewer: ScrollViewer | null = null;
  private container: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  private nativeSizes: Size[] = [];
  private loadedDoc: LoadedDocument | null = null;
  private currentZoom = 1;
  private viewportCbs = new Set<() => void>();
  private resizeObserver: ResizeObserver | null = null;
  private scrollListener: (() => void) | null = null;
  // Bumped on teardown so a load or search that resolves late can tell its
  // document has been torn down and must not touch adapter state.
  private generation = 0;
  // Per-page text runs in native (scale-1) CSS px, shared by search geometry.
  private runsCache = new Map<number, Promise<readonly DocxTextRunInfo[]>>();
  private measureForFont = createMeasureForFont();
  // Interactive search state: the query the engine currently holds and the
  // ordinal the engine's cursor sits on (-1 = none). searchSeq makes the state
  // commit last-search-wins: a superseded or timed-out search resolving late
  // must not replace it (it would freeze stepping by zeroing matchCount).
  // Activations are serialised through activationChain, with activateSeq
  // collapsing queued bursts to the latest target.
  private activeQuery: string | null = null;
  private engineCursor = -1;
  private matchCount = 0;
  private searchSeq = 0;
  private activateSeq = 0;
  private activationChain: Promise<void> = Promise.resolve();
  // Cancellers for in-flight find/search requests so teardown settles them
  // (with []) immediately instead of leaving work running on a dead adapter.
  private pendingFinds = new Set<() => void>();
  // Teardown hook for an in-flight load() so destroy()/abort settles it.
  private activeLoad: { cancel: (err: Error) => void } | null = null;

  constructor(options: DocxAdapterOptions = {}) {
    this.thumbnailsEnabled = options.thumbnails ?? false;
    this.wasmUrl = options.wasmUrl;
    this.capabilities = capabilitiesFor(options);
  }

  async load(
    source: DocumentSource,
    mount: HTMLElement,
    opts: LoadOptions,
  ): Promise<LoadedDocument> {
    const signal = opts.signal;
    if (signal?.aborted)
      throw new DOMException("DOCX load cancelled", "AbortError");

    const data =
      source.data instanceof ArrayBuffer
        ? source.data
        : await (source.data as Blob).arrayBuffer();
    if (signal?.aborted)
      throw new DOMException("DOCX load cancelled", "AbortError");

    const result = await validateZip(data);
    if (!result.valid) {
      throw createError(
        "SECURITY_ERROR",
        result.error ?? "Invalid DOCX archive",
        { format: "docx" },
      );
    }

    let cancelLoad!: (err: Error) => void;
    const cancellation = new Promise<never>((_, reject) => {
      cancelLoad = reject;
    });
    const loadHandle = { cancel: cancelLoad };
    this.activeLoad = loadHandle;

    const timer = setTimeout(
      () =>
        cancelLoad(
          createError("TIMEOUT", "DOCX render timed out after 30 seconds", {
            format: "docx",
          }),
        ),
      DOCX_RENDER_TIMEOUT,
    );
    const onAbort = (): void =>
      cancelLoad(new DOMException("DOCX load cancelled", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });

    // Keep a handle on the pipeline so a late rejection (after the race was
    // lost to timeout/abort) doesn't surface as an unhandled rejection.
    const pipeline = this.runLoad(data, mount, opts);
    pipeline.catch(() => {});

    try {
      return await Promise.race([pipeline, cancellation]);
    } catch (err) {
      this.teardownDocument();
      throw toDocxViewerError(err);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (this.activeLoad === loadHandle) this.activeLoad = null;
    }
  }

  private async runLoad(
    data: ArrayBuffer,
    mount: HTMLElement,
    opts: LoadOptions,
  ): Promise<LoadedDocument> {
    const generation = this.generation;
    // Parsing runs in the engine's Web Worker; layout must settle before page
    // count and per-page sizes are final (load() resolved only after a full
    // render before 3.0 too).
    const doc = await DocxDocument.load(data, {
      mode: "worker",
      ...(opts.password !== undefined ? { password: opts.password } : {}),
      ...(this.wasmUrl !== undefined ? { wasmUrl: this.wasmUrl } : {}),
    });
    if (generation !== this.generation) {
      doc.destroy();
      throw createError("WORKER_TERMINATED", "DOCX load cancelled", {
        format: "docx",
      });
    }
    this.doc = doc;
    await doc.waitUntilLayoutComplete();
    if (generation !== this.generation) {
      throw createError("WORKER_TERMINATED", "DOCX load cancelled", {
        format: "docx",
      });
    }

    const pageCount = Math.min(Math.max(1, doc.pageCount), MAX_DOCX_PAGES);
    this.nativeSizes = Array.from({ length: pageCount }, (_, i) => {
      const size = doc.pageSize(i);
      return {
        width: size.widthPt * PT_TO_PX,
        height: size.heightPt * PT_TO_PX,
      };
    });

    mount.innerHTML = "";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;background:transparent;";
    mount.appendChild(container);
    this.container = container;

    this.viewer = DocxScrollViewer.fromDocument(container, doc, {
      ...VIEWER_LAYOUT,
      background: "transparent",
      pageShadow: false,
      enableTextSelection: true,
      enableHyperlinks: true,
      onHyperlinkClick: (target) => this.handleHyperlink(target),
      onScaleChange: (scale) => {
        this.currentZoom = scale;
        this.notifyViewport();
      },
    });

    // The engine styles its scroll host asynchronously, so it may not be
    // discoverable yet — resolve it lazily (getScroller) and catch descendant
    // scrolls via a capture-phase listener on the container (scroll events
    // don't bubble, but they are capturable).
    this.scroller = null;
    this.scrollListener = () => this.notifyViewport();
    container.addEventListener("scroll", this.scrollListener, {
      capture: true,
      passive: true,
    });
    this.resizeObserver = new ResizeObserver(() => this.notifyViewport());
    this.resizeObserver.observe(container);

    this.currentZoom = this.viewer.getScale();
    this.loadedDoc = {
      pageCount,
      pages: this.nativeSizes.map((dimensions, index) => ({
        index,
        dimensions,
        rotation: 0,
      })),
    };
    this.notifyViewport();
    return this.loadedDoc;
  }

  destroy(): void {
    // Settle any in-flight load so a caller awaiting load() doesn't hang on a
    // dead adapter.
    if (this.activeLoad) {
      this.activeLoad.cancel(
        createError("WORKER_TERMINATED", "DOCX load cancelled", {
          format: "docx",
        }),
      );
      this.activeLoad = null;
    }
    // Copy first: each cancel() removes itself from the set as it runs.
    for (const cancel of [...this.pendingFinds]) cancel();
    this.teardownDocument();
    this.loadedDoc = null;
  }

  private teardownDocument(): void {
    this.generation++;
    if (this.container && this.scrollListener) {
      this.container.removeEventListener("scroll", this.scrollListener, {
        capture: true,
      });
    }
    this.scrollListener = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.viewer?.destroy();
    this.viewer = null;
    this.doc?.destroy();
    this.doc = null;
    this.container?.remove();
    this.container = null;
    this.scroller = null;
    this.nativeSizes = [];
    this.runsCache.clear();
    this.activeQuery = null;
    this.engineCursor = -1;
    this.matchCount = 0;
  }

  setZoom(scale: ZoomMode): void {
    if (!this.viewer) return;
    if (scale === "fit-width") this.viewer.fitWidth();
    else if (scale === "fit-page") this.viewer.fitPage();
    else this.viewer.setScale(scale);
    this.currentZoom = this.viewer.getScale();
    this.notifyViewport();
  }

  getZoom(): number {
    return this.currentZoom;
  }

  /** The engine's scroll host, resolved lazily: it is created and styled by
   * the viewer after mount, so the first load-time probe can miss it. Cached
   * once a real (non-fallback) host is found. */
  private getScroller(): HTMLElement | null {
    if (!this.container) return null;
    if (
      this.scroller &&
      this.scroller !== this.container &&
      this.scroller.isConnected
    ) {
      return this.scroller;
    }
    const host = findScrollHost(this.container);
    if (host !== this.container) this.scroller = host;
    return host;
  }

  getViewport(): ViewportMetrics | null {
    const scroller = this.getScroller();
    if (!scroller || this.nativeSizes.length === 0) return null;
    return computeViewportMetrics(scroller, this.nativeSizes, this.currentZoom);
  }

  subscribeViewport(callback: () => void): () => void {
    this.viewportCbs.add(callback);
    // Push a fresh snapshot so a late subscriber isn't left blank.
    if (this.container) queueMicrotask(callback);
    return () => {
      this.viewportCbs.delete(callback);
    };
  }

  private notifyViewport(): void {
    for (const cb of this.viewportCbs) cb();
  }

  goToPage?(n: number): void {
    if (!this.viewer) return;
    const index = Math.min(
      Math.max(0, n - 1),
      Math.max(0, this.nativeSizes.length - 1),
    );
    this.viewer.scrollToPage(index, { behavior: "auto" });
  }

  /**
   * One-shot text location. Enumerated locally from the engine's per-page text
   * runs (never through the viewer's find), so interactive search state and
   * on-screen highlights are untouched. Bounds are in the page's native
   * (un-zoomed) CSS pixels, top-left origin — the same space
   * {@link getViewport} reports.
   */
  findMatches(query: string): Promise<SearchMatch[]> {
    if (!this.doc || !query.trim()) return Promise.resolve([]);
    return this.raceFind(() => this.enumerateAllPages(query));
  }

  /**
   * Interactive search. The engine enumerates every occurrence (the same
   * enumeration that paints the highlights, so the yielded count and the marks
   * on screen always agree); geometry is attached from a local scan of the
   * same text runs, paired by per-page ordinal. Settles empty on
   * timeout/teardown.
   */
  search(query: string): AsyncIterable<SearchMatch> {
    if (!this.viewer || !query.trim())
      return createAsyncIterable<SearchMatch>([]);
    const seq = ++this.searchSeq;
    const reply = this.raceFind((token) =>
      this.runInteractiveSearch(query, seq, token),
    );
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next(): Promise<IteratorResult<SearchMatch>> {
            const items = await reply;
            const value = items[i];
            if (i < items.length && value !== undefined) {
              i++;
              return { value, done: false };
            }
            return { value: undefined as unknown as SearchMatch, done: true };
          },
        };
      },
    };
  }

  private async runInteractiveSearch(
    query: string,
    seq: number,
    token: { stale: boolean },
  ): Promise<SearchMatch[]> {
    const viewer = this.viewer;
    if (!viewer) return [];
    const generation = this.generation;
    const found = await viewer.findText(query);
    // Last search wins: a superseded search resolving late (the engine settles
    // it with []) or one whose caller already timed out must not replace the
    // interactive state — zeroed matchCount would freeze stepping on the live
    // query's matches.
    if (
      generation !== this.generation ||
      seq !== this.searchSeq ||
      token.stale
    ) {
      return [];
    }
    this.activeQuery = query;
    this.engineCursor = -1;
    this.matchCount = found.length;
    // A committed search supersedes any in-flight activation walk: its next
    // pre-step check exits, so at most one already-issued step still lands
    // (and that step's cursor write carries the engine's real position).
    this.activateSeq++;
    return this.attachBounds(found, query);
  }

  /** Pair the engine's matches (no geometry) with a local enumeration of the
   * same runs by per-page ordinal. Both scans use identical fold/scan
   * semantics, so ordinals line up; if they ever diverge the match degrades to
   * empty bounds (consumers then skip navigation) rather than mis-anchoring. */
  private async attachBounds(
    found: FindMatch<DocxMatchLocation>[],
    query: string,
  ): Promise<SearchMatch[]> {
    const generation = this.generation;
    const perPageOrdinal = new Map<number, number>();
    const results: SearchMatch[] = [];
    for (const match of found) {
      const page = match.location.page;
      const ordinal = perPageOrdinal.get(page) ?? 0;
      perPageOrdinal.set(page, ordinal + 1);

      let bounds: DocumentRect[] = [];
      const runs = await this.pageRuns(page);
      if (generation !== this.generation) return [];
      const local = enumerateMatches(runs, query)[ordinal];
      if (local) bounds = sliceBounds(runs, local, this.measureForFont);
      results.push({ pageIndex: page, text: match.text, bounds });
    }
    return results;
  }

  private async enumerateAllPages(query: string): Promise<SearchMatch[]> {
    const generation = this.generation;
    const results: SearchMatch[] = [];
    for (let page = 0; page < this.nativeSizes.length; page++) {
      const runs = await this.pageRuns(page);
      if (generation !== this.generation) return [];
      for (const match of enumerateMatches(runs, query)) {
        results.push({
          pageIndex: page,
          text: match.text,
          bounds: sliceBounds(runs, match, this.measureForFont),
        });
      }
    }
    return results;
  }

  /** Text runs for a page in native (scale-1) CSS px, cached per document. */
  private pageRuns(page: number): Promise<readonly DocxTextRunInfo[]> {
    const cached = this.runsCache.get(page);
    if (cached) return cached;
    const doc = this.doc;
    const native = this.nativeSizes[page];
    if (!doc || !native) return Promise.resolve([]);
    const runs = doc
      .collectPageRuns(page, { width: native.width })
      .catch(() => [] as DocxTextRunInfo[]);
    this.runsCache.set(page, runs);
    return runs;
  }

  // Race a find/search against the shared timeout, registered so teardown
  // settles in-flight requests with [] instead of leaving work running. The
  // token tells the work it has been settled early (timeout/teardown), so it
  // must not commit interactive state.
  private raceFind(
    work: (token: { stale: boolean }) => Promise<SearchMatch[]>,
  ): Promise<SearchMatch[]> {
    const token = { stale: false };
    return new Promise<SearchMatch[]>((resolve) => {
      let done = false;
      const settle = (value: SearchMatch[]): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.pendingFinds.delete(cancel);
        resolve(value);
      };
      const cancel = (): void => {
        token.stale = true;
        settle([]);
      };
      const timer = setTimeout(cancel, FIND_TIMEOUT);
      this.pendingFinds.add(cancel);
      work(token).then(settle, () => settle([]));
    });
  }

  clearSearch?(): void {
    this.searchSeq++;
    this.activateSeq++;
    this.viewer?.clearFind();
    this.activeQuery = null;
    this.engineCursor = -1;
    this.matchCount = 0;
  }

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
  setActiveSearchMatch(index: number | null): Promise<void> {
    if (!this.viewer || this.activeQuery === null) return Promise.resolve();
    const seq = ++this.activateSeq;
    this.activationChain = this.activationChain.then(() =>
      this.runActivation(seq, index).catch(() => {}),
    );
    return this.activationChain;
  }

  private async runActivation(
    seq: number,
    index: number | null,
  ): Promise<void> {
    // Collapse queued bursts: only the latest requested target runs.
    if (seq !== this.activateSeq) return;
    const viewer = this.viewer;
    const query = this.activeQuery;
    if (!viewer || query === null) return;

    if (index === null) {
      await viewer.findText(query).catch(() => {});
      if (seq === this.activateSeq) this.engineCursor = -1;
      return;
    }

    const len = this.matchCount;
    if (len === 0 || index < 0 || index >= len) return;
    const cur = this.engineCursor;
    const forward = cur === -1 ? index + 1 : (index - cur + len) % len;
    const backward = cur === -1 ? len - index : (cur - index + len) % len;
    const useNext = forward <= backward;
    const steps = Math.min(forward, backward);

    // The engine scrolls to the match's page top on every step (silurus
    // _activateMatch offers no suppress option), which paints as an up-then-
    // down lurch before the store's precise scroll-to-match. Pin the view:
    // undo each step's jump in the same microtask chain — nothing paints in
    // between — so the store's scrollToRect, issued once this walk settles,
    // stays the only scroll the user ever sees.
    const scroller = this.getScroller();
    const resting = scroller
      ? { left: scroller.scrollLeft, top: scroller.scrollTop }
      : null;

    for (let i = 0; i < steps; i++) {
      if (seq !== this.activateSeq || this.viewer !== viewer) return;
      const stepped = await (useNext
        ? viewer.findNext()
        : viewer.findPrev()
      ).catch(() => null);
      // Restore even on a failed step — the engine may have scrolled before
      // rejecting. Guarded like the engine's own scrolls: environments without
      // Element.scrollTo (jsdom) take the property path.
      if (scroller && resting) {
        if (typeof scroller.scrollTo === "function") {
          scroller.scrollTo({ ...resting, behavior: "auto" });
        } else {
          scroller.scrollLeft = resting.left;
          scroller.scrollTop = resting.top;
        }
      }
      if (!stepped) return;
      // The engine's returned ordinal is the truth — never assume the target.
      this.engineCursor = stepped.matchIndex;
    }
  }

  /** Scroll so `rect` (native units, top-left origin) on `pageIndex` is
   * visible, with the core's align/centre semantics. */
  async scrollToRect(
    pageIndex: number,
    rect: DocumentRect,
    opts: ScrollToRectOptions = {},
  ): Promise<void> {
    const scroller = this.getScroller();
    const metrics = this.getViewport();
    if (!metrics || !scroller) return;
    const target = computeScrollTarget(
      metrics,
      pageIndex,
      rect,
      opts.align ?? "center",
    );
    if (!target) return;
    scroller.scrollTo({
      left: target.left,
      top: target.top,
      behavior: opts.behavior ?? "smooth",
    });
  }

  async getThumbnail(page: number, maxPx: number): Promise<ImageBitmap> {
    if (!this.thumbnailsEnabled) {
      throw new Error("DOCX thumbnails are not enabled");
    }
    const doc = this.doc;
    if (!doc || this.nativeSizes.length === 0) {
      throw new Error("DOCX document not loaded");
    }
    const index = Math.min(
      Math.max(0, page - 1),
      this.nativeSizes.length - 1,
    );
    const native = this.nativeSizes[index];
    if (!native) throw new Error("DOCX document not loaded");
    // Cap the larger dimension at maxPx; renderPageToBitmap sizes by width.
    const width =
      native.width >= native.height
        ? maxPx
        : Math.max(1, Math.round((maxPx * native.width) / native.height));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("DOCX thumbnail timed out")),
        THUMBNAIL_TIMEOUT,
      );
    });
    try {
      return await Promise.race([
        doc.renderPageToBitmap(index, { width, dpr: 1 }),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** External links are filtered to http/https/mailto and relayed to the host
   * as a `link-click` window message (never navigated — same contract as the
   * pre-3.0 iframe relay). Internal bookmark links scroll within the document. */
  private handleHyperlink(target: HyperlinkTarget): void {
    if (target.kind === "external") {
      // Relay the canonical URL, never the document's raw string: smuggled
      // scheme-shaped targets (java%73cript:, jav&#97;script:, …) parse as
      // relative URLs and would otherwise pass the protocol check while
      // carrying a scheme-shaped payload to the host.
      const url = normalizeLinkTarget(target.url);
      if (url === null) return;
      window.postMessage(
        { type: "link-click", url },
        window.location.origin,
      );
      return;
    }
    const page = this.doc?.getBookmarkPage(target.ref);
    if (page !== undefined) this.viewer?.scrollToPage(page);
  }
}

export function createDocxAdapterFactory(
  options: DocxAdapterOptions = {},
): AdapterFactory {
  return {
    format: "docx",
    capabilities: capabilitiesFor(options),
    create: () => new DocxAdapter(options),
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
