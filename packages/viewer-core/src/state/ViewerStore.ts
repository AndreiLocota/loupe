import type {
  AdapterCapabilities,
  AdapterFactory,
  DocumentAdapter,
  DocumentAnnotation,
  DocumentLayer,
  DocumentSource,
  LoadedDocument,
  LoadOptions,
  ScrollToRectOptions,
  SearchMatch,
  ViewportMetrics,
  ZoomMode,
} from "../adapters/DocumentAdapter.js";
import { CancellationTokenSource } from "../cancellation/CancellationToken.js";
import { detectFormat } from "../detection/formatDetection.js";
import { createError, type ViewerError } from "../errors/ViewerError.js";
import { EventBus } from "../events/EventBus.js";
import { unionRects } from "../viewport/project.js";
import { computeVisiblePage } from "../viewport/visiblePage.js";

export type ViewerStatus = "idle" | "loading" | "loaded" | "error";

/** How long a navigation intent may suppress scroll-tracked page updates
 * before it is considered settled (smooth scrolls finish well within this). */
const NAV_SETTLE_TIMEOUT_MS = 2000;

export interface ViewerState {
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

export type ViewerEvent =
  | { type: "status-change"; status: ViewerStatus }
  | { type: "page-change"; page: number }
  | { type: "zoom-change"; zoom: ZoomMode }
  | {
      type: "search-change";
      query: string;
      matches: SearchMatch[];
      activeIndex: number;
    }
  | { type: "error"; error: ViewerError };

export type ViewerEventCallback = (event: ViewerEvent) => void;

const DEFAULT_STATE: ViewerState = {
  status: "idle",
  format: null,
  document: null,
  currentPage: 1,
  zoom: 1,
  searchQuery: "",
  searchMatches: [],
  activeSearchMatchIndex: -1,
  error: null,
};

export class ViewerStore {
  private state: ViewerState = { ...DEFAULT_STATE };
  private adapter: DocumentAdapter | null = null;
  private mountElement: HTMLElement | null = null;
  private events = new EventBus<ViewerEvent>();
  private loadCancellation: CancellationTokenSource | null = null;
  // Monotonic generation for search() calls. A search only commits its results
  // if it's still the latest — guards against a slow older query overwriting a
  // newer one, and against a load/close landing results on a torn-down adapter.
  private searchSeq = 0;
  private scrollToMatchSeq = 0;

  // Viewport subscribers persist across document loads; a single bridge is
  // (re)bound to whichever adapter is current so listeners survive swaps.
  private viewportListeners = new Set<() => void>();
  private adapterViewportUnsub: (() => void) | null = null;

  // Active programmatic navigation. While set, scroll-tracked page updates
  // that disagree with the target are dropped — otherwise the smooth scroll's
  // intermediate viewport events would feed back into currentPage. Cleared
  // when tracking sees the target page or the deadline passes (checked lazily
  // on viewport events; no timers).
  private navIntent: { page: number; until: number } | null = null;

  private registeredFactories = new Map<string, AdapterFactory>();

  registerFactory(factory: AdapterFactory): void {
    this.registeredFactories.set(factory.format, factory);
  }

  getState(): Readonly<ViewerState> {
    return this.state;
  }

  /**
   * Current zoom as a resolved numeric scale (1 = 100%). Unlike `state.zoom`
   * (which may be a mode like 'fit-width'), this reflects what the adapter
   * actually applied — useful for stepping zoom in/out from the real value.
   */
  getZoom(): number {
    const fromAdapter = this.adapter?.getZoom?.();
    if (typeof fromAdapter === "number") return fromAdapter;
    return typeof this.state.zoom === "number" ? this.state.zoom : 1;
  }

  /**
   * Live viewport metrics (scale, scroll, per-page geometry) for the current
   * document, or `null` when nothing is loaded or the adapter doesn't support
   * it (`capabilities.viewport === false`). Read fresh on each viewport change
   * — see {@link subscribeViewport}.
   */
  getViewport(): ViewportMetrics | null {
    return this.adapter?.getViewport?.() ?? null;
  }

  /**
   * Subscribe to viewport changes (scroll / zoom / resize / relayout). Returns
   * an unsubscribe function. The subscription persists across document loads.
   */
  subscribeViewport(callback: () => void): () => void {
    this.viewportListeners.add(callback);
    return () => {
      this.viewportListeners.delete(callback);
    };
  }

  /**
   * Resolve every occurrence of `query` to its match geometry without touching
   * interactive search state or drawing highlights — for building overlays
   * (e.g. marks/highlights) from text. Returns `[]` when unsupported.
   */
  locate(query: string): Promise<SearchMatch[]> {
    return this.adapter?.findMatches?.(query) ?? Promise.resolve([]);
  }

  /** (Re)bind the viewport bridge to the current adapter after an adapter swap. */
  private rebindViewport(): void {
    this.adapterViewportUnsub?.();
    this.adapterViewportUnsub =
      this.adapter?.subscribeViewport?.(() => {
        // Track first, so listeners reading getState() see the settled page.
        this.trackCurrentPage();
        for (const l of this.viewportListeners) l();
      }) ?? null;
  }

  /** Start (or replace) a navigation intent targeting `page` (1-based). */
  private armNavIntent(page: number): void {
    this.navIntent = { page, until: Date.now() + NAV_SETTLE_TIMEOUT_MS };
  }

  /**
   * Derive `currentPage` from live viewport geometry (greatest visible area —
   * see {@link computeVisiblePage}) so the page indicator follows scrolling.
   * Only trusts adapters reporting one rect per document page with a real
   * viewport size: aggregate geometry (DOCX's single content rect) and
   * frame-at-a-time reporting (TIFF) fail the count guard and keep their
   * existing navigation-driven behaviour, with no format checks needed.
   */
  private trackCurrentPage(): void {
    if (this.state.status !== "loaded" || !this.state.document) return;
    const metrics = this.adapter?.getViewport?.();
    if (!metrics) return;
    if (metrics.pages.length !== this.state.document.pageCount) return;
    if (metrics.client.width <= 0 || metrics.client.height <= 0) return;

    const visibleIndex = computeVisiblePage(metrics);
    if (visibleIndex === null) return;
    const visible = visibleIndex + 1;

    if (this.navIntent) {
      // Mid-flight programmatic scroll: drop disagreeing updates until the
      // target page shows up or the settle deadline lapses.
      if (visible !== this.navIntent.page && Date.now() < this.navIntent.until)
        return;
      this.navIntent = null;
    }

    if (visible !== this.state.currentPage) {
      this.setState({ currentPage: visible });
    }
  }

  /**
   * Capabilities of the adapter for the currently loaded document, or `null`
   * when nothing is loaded. Lets the shell decide which affordances to show
   * (e.g. a thumbnail rail only when `thumbnails` is supported).
   */
  getCapabilities(): AdapterCapabilities | null {
    return this.adapter?.capabilities ?? null;
  }

  /**
   * Toggleable content layers (PDF optional content groups) for the loaded
   * document. Empty when the adapter doesn't support layers or the document
   * has none.
   */
  getLayers(): DocumentLayer[] {
    if (!this.adapter?.capabilities.layers) return [];
    return this.adapter.getLayers?.() ?? [];
  }

  /** Show or hide a content layer by id. No-op if layers aren't supported. */
  setLayerVisibility(id: string, visible: boolean): void {
    if (!this.adapter?.capabilities.layers) return;
    this.adapter.setLayerVisibility?.(id, visible);
  }

  /**
   * Whether the annotation layer (links, markup, form appearances) is shown.
   * Defaults to `true`; `false` when the adapter doesn't support annotations.
   */
  areAnnotationsVisible(): boolean {
    if (!this.adapter?.capabilities.annotations) return false;
    return this.adapter.getAnnotationsVisible?.() ?? true;
  }

  /** Show or hide the annotation layer. No-op if annotations aren't supported. */
  setAnnotationsVisible(visible: boolean): void {
    if (!this.adapter?.capabilities.annotations) return;
    this.adapter.setAnnotationsVisible?.(visible);
  }

  /**
   * All annotations in the loaded document with metadata, for inspection.
   * Empty when the adapter doesn't support annotations.
   */
  async getAnnotations(): Promise<DocumentAnnotation[]> {
    if (!this.adapter?.capabilities.annotations) return [];
    return this.adapter.getAnnotations?.() ?? [];
  }

  /** Current display rotation in degrees, or 0 when rotation isn't supported. */
  getRotation(): number {
    if (!this.adapter?.capabilities.rotation) return 0;
    return this.adapter.getRotation?.() ?? 0;
  }

  /** Set absolute display rotation (degrees). No-op if rotation isn't supported. */
  setRotation(degrees: number): void {
    if (!this.adapter?.capabilities.rotation) return;
    this.adapter.setRotation?.(degrees);
  }

  /** Rotate by a relative delta (default +90°). No-op if rotation isn't supported. */
  rotate(delta = 90): void {
    if (!this.adapter?.capabilities.rotation) return;
    this.setRotation(this.getRotation() + delta);
  }

  subscribe(callback: ViewerEventCallback): () => void {
    return this.events.subscribe(callback);
  }

  async loadDocument(
    source: DocumentSource,
    opts: LoadOptions = {},
  ): Promise<void> {
    // Supersede any in-flight load. Cancel its token directly (rather than via
    // the public cancelLoad(), which would emit an 'idle' status blip) — the
    // 'loading' state set just below is the correct next state.
    if (this.loadCancellation) {
      this.loadCancellation.cancel();
      this.loadCancellation = null;
    }
    // Any in-flight search belongs to the previous document; retire it.
    this.searchSeq++;
    // Any navigation intent belongs to the previous document too.
    this.navIntent = null;

    this.loadCancellation = new CancellationTokenSource();
    // Capture the source instance (stable identity) to detect supersession.
    // NB: `.token` is a getter returning a fresh object each call, so it can't
    // be used for identity comparison.
    const cancellation = this.loadCancellation;
    const token = cancellation.token;

    // True only while this call is still the active load and it hasn't been
    // aborted. Checked after every await, before touching shared state.
    const isCurrent = (): boolean =>
      this.loadCancellation === cancellation && !token.aborted;

    // Clear the previous document/format up front so a load that fails or is
    // aborted can't leave the old document visible behind an 'error'/'idle'
    // state. Search state is reset too — matches belong to the old document,
    // and navigating from stale ones would scroll the new document blindly.
    this.setState({
      status: "loading",
      error: null,
      document: null,
      format: null,
      searchQuery: "",
      searchMatches: [],
      activeSearchMatchIndex: -1,
    });

    let createdAdapter: DocumentAdapter | null = null;

    try {
      const format = await this.detectFormat(source);
      // Bail before any shared-state mutation if a newer load / cancel / close
      // superseded us — otherwise we'd destroy the winner's adapter (and worse).
      if (!isCurrent()) return;
      if (!format) {
        throw createError("UNSUPPORTED_FORMAT", "Unsupported document format");
      }

      const factory = this.registeredFactories.get(format);
      if (!factory) {
        throw createError(
          "NO_ADAPTER_REGISTERED",
          `No adapter registered for format: ${format}`,
          { format },
        );
      }

      if (!this.mountElement) {
        throw createError(
          "NO_MOUNT_ELEMENT",
          "No mount element set. Call setMountElement() first.",
          { format },
        );
      }

      // Confirmed current: now it's safe to swap the adapter.
      if (this.adapter) {
        this.adapter.destroy();
        this.adapter = null;
      }
      createdAdapter = factory.create();
      this.adapter = createdAdapter;
      this.rebindViewport();

      const mergedSignal = opts.signal
        ? AbortSignal.any([opts.signal, token.signal])
        : token.signal;

      const document = await createdAdapter.load(source, this.mountElement, {
        ...opts,
        signal: mergedSignal,
      });

      // Superseded while loading: tear down the adapter we created so it doesn't
      // leak a worker / observers / mounted DOM, then stay silent.
      if (!isCurrent()) {
        createdAdapter.destroy();
        if (this.adapter === createdAdapter) this.adapter = null;
        return;
      }

      const currentPage = clampPage(opts.initialPage ?? 1, document.pageCount);

      this.setState({
        status: "loaded",
        format,
        document,
        currentPage,
        zoom: opts.initialZoom ?? "fit-width",
      });

      // Arm before setZoom: its synchronous viewport fire would otherwise be
      // tracked while the content still shows page 1, knocking currentPage back.
      if (currentPage > 1) this.armNavIntent(currentPage);
      createdAdapter.setZoom(this.state.zoom);
      if (currentPage > 1) createdAdapter.goToPage?.(currentPage);
    } catch (err) {
      // Superseded loads (including the ones we just cancelled) must stay silent.
      if (this.loadCancellation !== cancellation) return;
      // Tear down any partial adapter created for this now-failed load.
      if (this.adapter && this.adapter === createdAdapter) {
        this.adapter.destroy();
        this.adapter = null;
      }
      if ((err as Error).name === "AbortError") {
        this.setState({ status: "idle", format: null, document: null });
        return;
      }
      const error = toViewerError(err);
      this.setState({ status: "error", error });
      throw error;
    }
  }

  cancelLoad(): void {
    if (this.loadCancellation) {
      this.loadCancellation.cancel();
      this.loadCancellation = null;
    }
    this.searchSeq++;
    // A user-initiated cancel returns to idle (a superseding load uses its own
    // token cancel path in loadDocument and never goes through here).
    if (this.state.status === "loading") {
      this.setState({ status: "idle", format: null, document: null });
    }
  }

  closeDocument(): void {
    this.cancelLoad();
    this.navIntent = null;
    if (this.adapter) {
      this.adapter.destroy();
      this.adapter = null;
      this.rebindViewport();
    }
    // Deliberately does NOT touch mountElement: its lifecycle belongs to
    // whoever called setMountElement (e.g. ViewerSurface's mount/unmount
    // effect). Nulling it here broke consumers that close and reload while
    // the surface stays mounted — the next loadDocument threw
    // NO_MOUNT_ELEMENT because nothing re-registers the element.
    this.setState({ ...DEFAULT_STATE });
  }

  setMountElement(el: HTMLElement | null): void {
    this.mountElement = el;
  }

  goToPage(page: number): void {
    if (!this.adapter?.capabilities.pageCount) return;
    if (!this.state.document) return;
    // Ignore NaN/Infinity and snap fractional inputs (reachable from an
    // uncontrolled page-number input) to a whole page.
    if (!Number.isFinite(page)) return;

    const clamped = clampPage(page, this.state.document.pageCount);
    this.armNavIntent(clamped);
    this.adapter.goToPage?.(clamped);
    this.setState({ currentPage: clamped });
  }

  setZoom(zoom: ZoomMode): void {
    this.adapter?.setZoom(zoom);
    this.setState({ zoom });
  }

  async search(query: string): Promise<void> {
    if (!this.adapter?.capabilities.textSearch) return;

    const seq = ++this.searchSeq;
    this.setState({ searchQuery: query });

    if (!query.trim()) {
      this.adapter.clearSearch?.();
      this.setState({ searchMatches: [], activeSearchMatchIndex: -1 });
      return;
    }

    const matches: SearchMatch[] = [];
    const iter = this.adapter.search?.(query);
    if (iter) {
      for await (const match of iter) {
        // A newer search (or a load/close) superseded this one — stop pulling
        // from what may now be a torn-down adapter and don't commit results.
        if (seq !== this.searchSeq) return;
        matches.push(match);
      }
    }

    if (seq !== this.searchSeq) return;
    this.setState({
      searchMatches: matches,
      activeSearchMatchIndex: matches.length > 0 ? 0 : -1,
    });
    // Land on the first match in the same action as the search itself.
    if (matches.length > 0) void this.scrollToSearchMatch();
  }

  clearSearch(): void {
    this.adapter?.clearSearch?.();
    this.adapter?.setActiveSearchMatch?.(null);
    this.setState({
      searchQuery: "",
      searchMatches: [],
      activeSearchMatchIndex: -1,
    });
  }

  nextSearchMatch(): void {
    const { searchMatches, activeSearchMatchIndex } = this.state;
    if (searchMatches.length === 0) return;
    const next = (activeSearchMatchIndex + 1) % searchMatches.length;
    this.setState({ activeSearchMatchIndex: next });
    void this.scrollToSearchMatch();
  }

  previousSearchMatch(): void {
    const { searchMatches, activeSearchMatchIndex } = this.state;
    if (searchMatches.length === 0) return;
    const prev =
      (activeSearchMatchIndex - 1 + searchMatches.length) %
      searchMatches.length;
    this.setState({ activeSearchMatchIndex: prev });
    void this.scrollToSearchMatch();
  }

  /**
   * Scroll the document to a search match — by default the active one; passing
   * `index` also makes that match active (clamped, emits 'search-change').
   * Uses the adapter's precise `scrollToRect` when supported, falls back to
   * page-level `goToPage`, and does nothing for matches without geometry
   * (`bounds: []`, e.g. DOCX's iframe-side search).
   */
  async scrollToSearchMatch(
    index?: number,
    opts?: ScrollToRectOptions,
  ): Promise<void> {
    const { searchMatches } = this.state;
    if (searchMatches.length === 0) return;

    let active = this.state.activeSearchMatchIndex;
    if (index !== undefined) {
      if (!Number.isFinite(index)) return;
      active = Math.max(
        0,
        Math.min(Math.round(index), searchMatches.length - 1),
      );
      this.setState({ activeSearchMatchIndex: active });
    }
    if (active < 0) return;

    const seq = ++this.scrollToMatchSeq;
    const searchSeqAtIssue = this.searchSeq;
    const activation = this.adapter?.setActiveSearchMatch?.(active);

    const match = searchMatches[active];
    if (!match || match.bounds.length === 0) return;

    if (this.adapter?.capabilities.scrollToRect && this.adapter.scrollToRect) {
      const rect = unionRects(match.bounds);
      if (!rect) return;
      // An async activation can scroll the viewport itself (the DOCX engine
      // scrolls to the match's page top on every cursor step), so wait it out
      // — our precise scroll must be issued last or it gets cancelled. Bail if
      // superseded while waiting: by a newer scroll, by a new search — at its
      // *entry* (searchSeq), since its commit may carry zero matches and issue
      // no corrective scroll — or by anything replacing the match list.
      if (activation) {
        try {
          await activation;
        } catch {
          // A rejected activation is treated as settled: the match geometry
          // is independent of the walk's outcome, so still scroll to it.
        }
        if (
          seq !== this.scrollToMatchSeq ||
          searchSeqAtIssue !== this.searchSeq ||
          this.state.searchMatches !== searchMatches
        ) {
          return;
        }
      }
      // scrollToRect can await settled layout for seconds, so arm only once it
      // resolves — the smooth scroll (and its viewport events) start then.
      await this.adapter.scrollToRect(match.pageIndex, rect, opts);
      this.armNavIntent(match.pageIndex + 1);
      this.setState({ currentPage: match.pageIndex + 1 });
    } else {
      this.goToPage(match.pageIndex + 1);
    }
  }

  async getThumbnail(
    page: number,
    maxPx: number = 200,
  ): Promise<ImageBitmap | null> {
    if (!this.adapter?.capabilities.thumbnails) return null;
    return this.adapter.getThumbnail?.(page, maxPx) ?? null;
  }

  private async detectFormat(source: DocumentSource): Promise<string | null> {
    return detectFormat(source);
  }

  private setState(partial: Partial<ViewerState>): void {
    const prev = this.state;
    this.state = { ...this.state, ...partial };

    const newState = this.state;
    if (partial.status !== undefined && partial.status !== prev.status) {
      this.events.emit({ type: "status-change", status: newState.status });
    }
    if (
      partial.currentPage !== undefined &&
      partial.currentPage !== prev.currentPage
    ) {
      this.events.emit({ type: "page-change", page: newState.currentPage });
    }
    if (partial.zoom !== undefined && partial.zoom !== prev.zoom) {
      this.events.emit({ type: "zoom-change", zoom: newState.zoom });
    }
    if (
      partial.searchQuery !== undefined ||
      partial.searchMatches !== undefined ||
      partial.activeSearchMatchIndex !== undefined
    ) {
      this.events.emit({
        type: "search-change",
        query: newState.searchQuery,
        matches: newState.searchMatches,
        activeIndex: newState.activeSearchMatchIndex,
      });
    }
    if (partial.error !== undefined && partial.error !== null) {
      this.events.emit({ type: "error", error: partial.error });
    }
  }
}

/** Clamp a (possibly fractional / out-of-range) page to a whole page in [1, pageCount]. */
function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.min(Math.round(page), Math.max(1, pageCount)));
}

/**
 * Normalize any thrown value into a `ViewerError` so `state.error.code` /
 * `.recoverable` are always populated. Errors already carrying a code (from
 * `createError` or an adapter) pass through; anything else becomes `LOAD_FAILED`.
 */
function toViewerError(err: unknown): ViewerError {
  if (err instanceof Error && "code" in err) {
    const e = err as ViewerError;
    if (typeof e.recoverable !== "boolean") e.recoverable = false;
    return e;
  }
  const message = err instanceof Error ? err.message : String(err);
  return createError("LOAD_FAILED", message);
}
