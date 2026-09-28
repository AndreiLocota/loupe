// packages/viewer-core/src/cancellation/CancellationToken.ts
var CancellationTokenSource = class {
  controller = new AbortController();
  _aborted = false;
  get token() {
    const src = this;
    return {
      get aborted() {
        return src._aborted;
      },
      get signal() {
        return src.controller.signal;
      },
      get abortError() {
        return new DOMException("Operation cancelled", "AbortError");
      },
      throwIfAborted() {
        if (src._aborted) throw src.token.abortError;
      }
    };
  }
  cancel() {
    if (this._aborted) return;
    this._aborted = true;
    this.controller.abort();
  }
  get aborted() {
    return this._aborted;
  }
};

// packages/viewer-core/src/detection/formatDetection.ts
var SIGNATURES = [
  { format: "pdf", offset: 0, bytes: [37, 80, 68, 70] },
  // ISO-BMFF `ftyp` brands for HEIF/HEIC still images ('heic','heix','hevc',
  // 'heif','mif1'). All share the `ftyp` box at offset 4.
  { format: "image", offset: 4, bytes: [102, 116, 121, 112, 104, 101, 105, 99] },
  // ftypheic
  { format: "image", offset: 4, bytes: [102, 116, 121, 112, 104, 101, 105, 120] },
  // ftypheix
  { format: "image", offset: 4, bytes: [102, 116, 121, 112, 104, 101, 118, 99] },
  // ftyphevc
  { format: "image", offset: 4, bytes: [102, 116, 121, 112, 104, 101, 105, 102] },
  // ftypheif
  { format: "image", offset: 4, bytes: [102, 116, 121, 112, 109, 105, 102, 49] }
  // ftypmif1
];
var RASTER_SIGNATURES = [
  { format: "image", offset: 0, bytes: [255, 216, 255] },
  // JPEG SOI
  { format: "image", offset: 0, bytes: [137, 80, 78, 71] },
  // PNG
  { format: "image", offset: 0, bytes: [71, 73, 70, 56] },
  // GIF87a/GIF89a
  { format: "image", offset: 0, bytes: [73, 73, 42, 0] },
  // TIFF little-endian (incl. 42 magic)
  { format: "image", offset: 0, bytes: [77, 77, 0, 42] }
  // TIFF big-endian (incl. 42 magic)
];
var RIFF_MAGIC = [82, 73, 70, 70];
var WEBP_MAGIC = [87, 69, 66, 80];
var SVG_SIGNATURE = "<svg";
var CONTENT_TYPES_PROBE = "[Content_Types].xml";
function bytesMatch(buffer, offset, signature) {
  if (offset + signature.length > buffer.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}
function bufferToString(buffer, start, end) {
  return new TextDecoder().decode(buffer.slice(start, end));
}
async function isDocx(source) {
  const buffer = await toUint8Array(source);
  if (buffer.length < 4) return false;
  if (!bytesMatch(buffer, 0, [80, 75, 3, 4])) return false;
  const text = bufferToString(buffer, 0, Math.min(buffer.length, 1024 * 64));
  return text.includes(CONTENT_TYPES_PROBE);
}
async function toUint8Array(source) {
  const data = source.data;
  if (typeof data === "object" && data !== null && "arrayBuffer" in data && typeof data.arrayBuffer === "function") {
    const buffer = await data.arrayBuffer();
    return new Uint8Array(buffer);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}
async function detectFormat(source) {
  const buffer = await toUint8Array(source);
  const head = buffer;
  if (head.length < 2) return null;
  for (const sig of SIGNATURES) {
    if (bytesMatch(head, sig.offset, sig.bytes)) return sig.format;
  }
  for (const sig of RASTER_SIGNATURES) {
    if (bytesMatch(head, sig.offset, sig.bytes)) return sig.format;
  }
  if (bytesMatch(head, 0, RIFF_MAGIC) && bytesMatch(head, 8, WEBP_MAGIC)) return "image";
  const textHead = bufferToString(head, 0, Math.min(head.length, 500));
  const trimmed = textHead.trimStart();
  if (trimmed.startsWith("<") && trimmed.toLowerCase().includes(SVG_SIGNATURE)) return "image";
  const maybeDocx = await isDocx(source);
  if (maybeDocx) return "docx";
  return null;
}

// packages/viewer-core/src/errors/ViewerError.ts
function createError(code, message, opts) {
  const error = Object.assign(new Error(message), {
    code,
    format: opts?.format,
    recoverable: opts?.recoverable ?? isRecoverable(code)
  });
  return error;
}
function isRecoverable(code) {
  switch (code) {
    case "LOAD_FAILED":
    case "PASSWORD_REQUIRED":
    case "CANCELLED":
    case "TIMEOUT":
      return true;
    default:
      return false;
  }
}

// packages/viewer-core/src/events/EventBus.ts
var EventBus = class {
  listeners = /* @__PURE__ */ new Set();
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  emit(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }
  clear() {
    this.listeners.clear();
  }
  get listenerCount() {
    return this.listeners.size;
  }
};

// packages/viewer-core/src/viewport/project.ts
function projectRect(metrics, pageIndex, rect) {
  const page = metrics.pages.find((p) => p.index === pageIndex);
  if (!page) return null;
  const rot = (metrics.rotation % 360 + 360) % 360;
  const s = metrics.scale;
  const Wn = page.nativeWidth;
  const Hn = page.nativeHeight;
  const { x, y, width, height } = rect;
  let rlx;
  let rly;
  let rw;
  let rh;
  switch (rot) {
    case 90:
      rlx = Hn - (y + height);
      rly = x;
      rw = height;
      rh = width;
      break;
    case 180:
      rlx = Wn - (x + width);
      rly = Hn - (y + height);
      rw = width;
      rh = height;
      break;
    case 270:
      rlx = y;
      rly = Wn - (x + width);
      rw = height;
      rh = width;
      break;
    default:
      rlx = x;
      rly = y;
      rw = width;
      rh = height;
  }
  return {
    x: page.x + rlx * s - metrics.scroll.x,
    y: page.y + rly * s - metrics.scroll.y,
    width: rw * s,
    height: rh * s
  };
}
function unionRects(rects) {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
var START_ALIGN_PADDING = 16;
function computeScrollTarget(metrics, pageIndex, rect, align = "center") {
  const p = projectRect(metrics, pageIndex, rect);
  if (!p) return null;
  const cx = p.x + metrics.scroll.x;
  const cy = p.y + metrics.scroll.y;
  let left;
  let top;
  if (align === "start") {
    left = cx - START_ALIGN_PADDING;
    top = cy - START_ALIGN_PADDING;
  } else {
    left = cx - (metrics.client.width - p.width) / 2;
    top = cy - (metrics.client.height - p.height) / 2;
  }
  const maxLeft = Math.max(0, metrics.content.width - metrics.client.width);
  const maxTop = Math.max(0, metrics.content.height - metrics.client.height);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop)
  };
}

// packages/viewer-core/src/viewport/visiblePage.ts
function computeVisiblePage(metrics) {
  const { pages, scroll, client } = metrics;
  if (pages.length === 0) return null;
  const viewLeft = scroll.x;
  const viewTop = scroll.y;
  const viewRight = scroll.x + client.width;
  const viewBottom = scroll.y + client.height;
  let best = null;
  let bestArea = 0;
  for (const page of pages) {
    const w = Math.min(page.x + page.width, viewRight) - Math.max(page.x, viewLeft);
    const h = Math.min(page.y + page.height, viewBottom) - Math.max(page.y, viewTop);
    if (w <= 0 || h <= 0) continue;
    const area = w * h;
    if (area > bestArea || area === bestArea && best !== null && page.index < best) {
      best = page.index;
      bestArea = area;
    }
  }
  if (best !== null) return best;
  const cx = viewLeft + client.width / 2;
  const cy = viewTop + client.height / 2;
  let nearest = null;
  let nearestDist = Infinity;
  for (const page of pages) {
    const dx = page.x + page.width / 2 - cx;
    const dy = page.y + page.height / 2 - cy;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist || dist === nearestDist && nearest !== null && page.index < nearest) {
      nearest = page.index;
      nearestDist = dist;
    }
  }
  return nearest;
}

// packages/viewer-core/src/state/ViewerStore.ts
var NAV_SETTLE_TIMEOUT_MS = 2e3;
var DEFAULT_STATE = {
  status: "idle",
  format: null,
  document: null,
  currentPage: 1,
  zoom: 1,
  searchQuery: "",
  searchMatches: [],
  activeSearchMatchIndex: -1,
  error: null
};
var ViewerStore = class {
  state = { ...DEFAULT_STATE };
  adapter = null;
  mountElement = null;
  events = new EventBus();
  loadCancellation = null;
  // Monotonic generation for search() calls. A search only commits its results
  // if it's still the latest — guards against a slow older query overwriting a
  // newer one, and against a load/close landing results on a torn-down adapter.
  searchSeq = 0;
  scrollToMatchSeq = 0;
  // Viewport subscribers persist across document loads; a single bridge is
  // (re)bound to whichever adapter is current so listeners survive swaps.
  viewportListeners = /* @__PURE__ */ new Set();
  adapterViewportUnsub = null;
  // Active programmatic navigation. While set, scroll-tracked page updates
  // that disagree with the target are dropped — otherwise the smooth scroll's
  // intermediate viewport events would feed back into currentPage. Cleared
  // when tracking sees the target page or the deadline passes (checked lazily
  // on viewport events; no timers).
  navIntent = null;
  registeredFactories = /* @__PURE__ */ new Map();
  registerFactory(factory) {
    this.registeredFactories.set(factory.format, factory);
  }
  getState() {
    return this.state;
  }
  /**
   * Current zoom as a resolved numeric scale (1 = 100%). Unlike `state.zoom`
   * (which may be a mode like 'fit-width'), this reflects what the adapter
   * actually applied — useful for stepping zoom in/out from the real value.
   */
  getZoom() {
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
  getViewport() {
    return this.adapter?.getViewport?.() ?? null;
  }
  /**
   * Subscribe to viewport changes (scroll / zoom / resize / relayout). Returns
   * an unsubscribe function. The subscription persists across document loads.
   */
  subscribeViewport(callback) {
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
  locate(query) {
    return this.adapter?.findMatches?.(query) ?? Promise.resolve([]);
  }
  /** (Re)bind the viewport bridge to the current adapter after an adapter swap. */
  rebindViewport() {
    this.adapterViewportUnsub?.();
    this.adapterViewportUnsub = this.adapter?.subscribeViewport?.(() => {
      this.trackCurrentPage();
      for (const l of this.viewportListeners) l();
    }) ?? null;
  }
  /** Start (or replace) a navigation intent targeting `page` (1-based). */
  armNavIntent(page) {
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
  trackCurrentPage() {
    if (this.state.status !== "loaded" || !this.state.document) return;
    const metrics = this.adapter?.getViewport?.();
    if (!metrics) return;
    if (metrics.pages.length !== this.state.document.pageCount) return;
    if (metrics.client.width <= 0 || metrics.client.height <= 0) return;
    const visibleIndex = computeVisiblePage(metrics);
    if (visibleIndex === null) return;
    const visible = visibleIndex + 1;
    if (this.navIntent) {
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
  getCapabilities() {
    return this.adapter?.capabilities ?? null;
  }
  /**
   * Toggleable content layers (PDF optional content groups) for the loaded
   * document. Empty when the adapter doesn't support layers or the document
   * has none.
   */
  getLayers() {
    if (!this.adapter?.capabilities.layers) return [];
    return this.adapter.getLayers?.() ?? [];
  }
  /** Show or hide a content layer by id. No-op if layers aren't supported. */
  setLayerVisibility(id, visible) {
    if (!this.adapter?.capabilities.layers) return;
    this.adapter.setLayerVisibility?.(id, visible);
  }
  /**
   * Whether the annotation layer (links, markup, form appearances) is shown.
   * Defaults to `true`; `false` when the adapter doesn't support annotations.
   */
  areAnnotationsVisible() {
    if (!this.adapter?.capabilities.annotations) return false;
    return this.adapter.getAnnotationsVisible?.() ?? true;
  }
  /** Show or hide the annotation layer. No-op if annotations aren't supported. */
  setAnnotationsVisible(visible) {
    if (!this.adapter?.capabilities.annotations) return;
    this.adapter.setAnnotationsVisible?.(visible);
  }
  /**
   * All annotations in the loaded document with metadata, for inspection.
   * Empty when the adapter doesn't support annotations.
   */
  async getAnnotations() {
    if (!this.adapter?.capabilities.annotations) return [];
    return this.adapter.getAnnotations?.() ?? [];
  }
  /** Current display rotation in degrees, or 0 when rotation isn't supported. */
  getRotation() {
    if (!this.adapter?.capabilities.rotation) return 0;
    return this.adapter.getRotation?.() ?? 0;
  }
  /** Set absolute display rotation (degrees). No-op if rotation isn't supported. */
  setRotation(degrees) {
    if (!this.adapter?.capabilities.rotation) return;
    this.adapter.setRotation?.(degrees);
  }
  /** Rotate by a relative delta (default +90°). No-op if rotation isn't supported. */
  rotate(delta = 90) {
    if (!this.adapter?.capabilities.rotation) return;
    this.setRotation(this.getRotation() + delta);
  }
  subscribe(callback) {
    return this.events.subscribe(callback);
  }
  async loadDocument(source, opts = {}) {
    if (this.loadCancellation) {
      this.loadCancellation.cancel();
      this.loadCancellation = null;
    }
    this.searchSeq++;
    this.navIntent = null;
    this.loadCancellation = new CancellationTokenSource();
    const cancellation = this.loadCancellation;
    const token = cancellation.token;
    const isCurrent = () => this.loadCancellation === cancellation && !token.aborted;
    this.setState({
      status: "loading",
      error: null,
      document: null,
      format: null,
      searchQuery: "",
      searchMatches: [],
      activeSearchMatchIndex: -1
    });
    let createdAdapter = null;
    try {
      const format = await this.detectFormat(source);
      if (!isCurrent()) return;
      if (!format) {
        throw createError("UNSUPPORTED_FORMAT", "Unsupported document format");
      }
      const factory = this.registeredFactories.get(format);
      if (!factory) {
        throw createError(
          "NO_ADAPTER_REGISTERED",
          `No adapter registered for format: ${format}`,
          { format }
        );
      }
      if (!this.mountElement) {
        throw createError(
          "NO_MOUNT_ELEMENT",
          "No mount element set. Call setMountElement() first.",
          { format }
        );
      }
      if (this.adapter) {
        this.adapter.destroy();
        this.adapter = null;
      }
      createdAdapter = factory.create();
      this.adapter = createdAdapter;
      this.rebindViewport();
      const mergedSignal = opts.signal ? AbortSignal.any([opts.signal, token.signal]) : token.signal;
      const document = await createdAdapter.load(source, this.mountElement, {
        ...opts,
        signal: mergedSignal
      });
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
        zoom: opts.initialZoom ?? "fit-width"
      });
      if (currentPage > 1) this.armNavIntent(currentPage);
      createdAdapter.setZoom(this.state.zoom);
      if (currentPage > 1) createdAdapter.goToPage?.(currentPage);
    } catch (err) {
      if (this.loadCancellation !== cancellation) return;
      if (this.adapter && this.adapter === createdAdapter) {
        this.adapter.destroy();
        this.adapter = null;
      }
      if (err.name === "AbortError") {
        this.setState({ status: "idle", format: null, document: null });
        return;
      }
      const error = toViewerError(err);
      this.setState({ status: "error", error });
      throw error;
    }
  }
  cancelLoad() {
    if (this.loadCancellation) {
      this.loadCancellation.cancel();
      this.loadCancellation = null;
    }
    this.searchSeq++;
    if (this.state.status === "loading") {
      this.setState({ status: "idle", format: null, document: null });
    }
  }
  closeDocument() {
    this.cancelLoad();
    this.navIntent = null;
    if (this.adapter) {
      this.adapter.destroy();
      this.adapter = null;
      this.rebindViewport();
    }
    this.setState({ ...DEFAULT_STATE });
  }
  setMountElement(el) {
    this.mountElement = el;
  }
  goToPage(page) {
    if (!this.adapter?.capabilities.pageCount) return;
    if (!this.state.document) return;
    if (!Number.isFinite(page)) return;
    const clamped = clampPage(page, this.state.document.pageCount);
    this.armNavIntent(clamped);
    this.adapter.goToPage?.(clamped);
    this.setState({ currentPage: clamped });
  }
  setZoom(zoom) {
    this.adapter?.setZoom(zoom);
    this.setState({ zoom });
  }
  async search(query) {
    if (!this.adapter?.capabilities.textSearch) return;
    const seq = ++this.searchSeq;
    this.setState({ searchQuery: query });
    if (!query.trim()) {
      this.adapter.clearSearch?.();
      this.setState({ searchMatches: [], activeSearchMatchIndex: -1 });
      return;
    }
    const matches = [];
    const iter = this.adapter.search?.(query);
    if (iter) {
      for await (const match of iter) {
        if (seq !== this.searchSeq) return;
        matches.push(match);
      }
    }
    if (seq !== this.searchSeq) return;
    this.setState({
      searchMatches: matches,
      activeSearchMatchIndex: matches.length > 0 ? 0 : -1
    });
    if (matches.length > 0) void this.scrollToSearchMatch();
  }
  clearSearch() {
    this.adapter?.clearSearch?.();
    this.adapter?.setActiveSearchMatch?.(null);
    this.setState({
      searchQuery: "",
      searchMatches: [],
      activeSearchMatchIndex: -1
    });
  }
  nextSearchMatch() {
    const { searchMatches, activeSearchMatchIndex } = this.state;
    if (searchMatches.length === 0) return;
    const next = (activeSearchMatchIndex + 1) % searchMatches.length;
    this.setState({ activeSearchMatchIndex: next });
    void this.scrollToSearchMatch();
  }
  previousSearchMatch() {
    const { searchMatches, activeSearchMatchIndex } = this.state;
    if (searchMatches.length === 0) return;
    const prev = (activeSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
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
  async scrollToSearchMatch(index, opts) {
    const { searchMatches } = this.state;
    if (searchMatches.length === 0) return;
    let active = this.state.activeSearchMatchIndex;
    if (index !== void 0) {
      if (!Number.isFinite(index)) return;
      active = Math.max(
        0,
        Math.min(Math.round(index), searchMatches.length - 1)
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
      if (activation) {
        try {
          await activation;
        } catch {
        }
        if (seq !== this.scrollToMatchSeq || searchSeqAtIssue !== this.searchSeq || this.state.searchMatches !== searchMatches) {
          return;
        }
      }
      await this.adapter.scrollToRect(match.pageIndex, rect, opts);
      this.armNavIntent(match.pageIndex + 1);
      this.setState({ currentPage: match.pageIndex + 1 });
    } else {
      this.goToPage(match.pageIndex + 1);
    }
  }
  async getThumbnail(page, maxPx = 200) {
    if (!this.adapter?.capabilities.thumbnails) return null;
    return this.adapter.getThumbnail?.(page, maxPx) ?? null;
  }
  async detectFormat(source) {
    return detectFormat(source);
  }
  setState(partial) {
    const prev = this.state;
    this.state = { ...this.state, ...partial };
    const newState = this.state;
    if (partial.status !== void 0 && partial.status !== prev.status) {
      this.events.emit({ type: "status-change", status: newState.status });
    }
    if (partial.currentPage !== void 0 && partial.currentPage !== prev.currentPage) {
      this.events.emit({ type: "page-change", page: newState.currentPage });
    }
    if (partial.zoom !== void 0 && partial.zoom !== prev.zoom) {
      this.events.emit({ type: "zoom-change", zoom: newState.zoom });
    }
    if (partial.searchQuery !== void 0 || partial.searchMatches !== void 0 || partial.activeSearchMatchIndex !== void 0) {
      this.events.emit({
        type: "search-change",
        query: newState.searchQuery,
        matches: newState.searchMatches,
        activeIndex: newState.activeSearchMatchIndex
      });
    }
    if (partial.error !== void 0 && partial.error !== null) {
      this.events.emit({ type: "error", error: partial.error });
    }
  }
};
function clampPage(page, pageCount) {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.min(Math.round(page), Math.max(1, pageCount)));
}
function toViewerError(err) {
  if (err instanceof Error && "code" in err) {
    const e = err;
    if (typeof e.recoverable !== "boolean") e.recoverable = false;
    return e;
  }
  const message = err instanceof Error ? err.message : String(err);
  return createError("LOAD_FAILED", message);
}
export {
  CancellationTokenSource,
  EventBus,
  ViewerStore,
  computeScrollTarget,
  computeVisiblePage,
  createError,
  detectFormat,
  projectRect,
  unionRects
};
//# sourceMappingURL=index.js.map