// packages/viewer-docx/src/DocxAdapter.ts
import {
  computeScrollTarget,
  createError as createError2
} from "@veridox-ai/loupe-core";
import {
  DocxDocument,
  DocxScrollViewer
} from "@silurus/ooxml/docx";

// packages/viewer-docx/src/errors.ts
import { createError } from "@veridox-ai/loupe-core";
import {
  OoxmlDecodedImageLimitError,
  OoxmlError,
  OoxmlResourceLimitError
} from "@silurus/ooxml/docx";
var PASSWORD_CODES = /* @__PURE__ */ new Set(["encrypted", "invalid-password"]);
function isViewerError(err) {
  return err instanceof Error && typeof err.code === "string" && typeof err.recoverable === "boolean";
}
function toDocxViewerError(err) {
  if (err instanceof DOMException && err.name === "AbortError") return err;
  if (isViewerError(err)) return err;
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof OoxmlResourceLimitError || err instanceof OoxmlDecodedImageLimitError || name === "OoxmlResourceLimitError" || name === "OoxmlDecodedImageLimitError") {
    return createError("RESOURCE_EXHAUSTED", message, { format: "docx" });
  }
  const code = err instanceof OoxmlError ? err.code : name === "OoxmlError" ? err.code : void 0;
  if (code && PASSWORD_CODES.has(code)) {
    return createError("PASSWORD_REQUIRED", message, { format: "docx" });
  }
  return createError("DECODE_ERROR", message || "DOCX render failed", {
    format: "docx"
  });
}

// packages/viewer-docx/src/geometry.ts
var PT_TO_PX = 96 / 72;
var VIEWER_LAYOUT = {
  gap: 16,
  paddingTop: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  paddingRight: 16
};
function findScrollHost(container) {
  const candidates = [
    container,
    ...Array.from(container.querySelectorAll("div"))
  ];
  for (const el of candidates) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return container;
}
function computePageRects(nativeSizes, scale, contentWidth) {
  const rects = [];
  let y = VIEWER_LAYOUT.paddingTop;
  for (let i = 0; i < nativeSizes.length; i++) {
    const native = nativeSizes[i];
    if (!native) continue;
    const width = native.width * scale;
    const height = native.height * scale;
    rects.push({
      index: i,
      x: Math.max(VIEWER_LAYOUT.paddingLeft, (contentWidth - width) / 2),
      y,
      width,
      height,
      nativeWidth: native.width,
      nativeHeight: native.height
    });
    y += height + VIEWER_LAYOUT.gap;
  }
  return rects;
}
function computeViewportMetrics(scroller, nativeSizes, scale) {
  const content = {
    width: scroller.scrollWidth,
    height: scroller.scrollHeight
  };
  return {
    scale,
    rotation: 0,
    scroll: { x: scroller.scrollLeft, y: scroller.scrollTop },
    content,
    client: { width: scroller.clientWidth, height: scroller.clientHeight },
    devicePixelRatio: globalThis.devicePixelRatio ?? 1,
    unit: "px",
    pages: computePageRects(nativeSizes, scale, content.width)
  };
}

// packages/viewer-docx/src/links.ts
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
function normalizeLinkTarget(href) {
  if (href.trim() === "") return null;
  try {
    const url = new URL(href, globalThis.location?.href);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

// packages/viewer-docx/src/textMatch.ts
function foldCase(s) {
  const lower = s.toLowerCase();
  if (lower.length === s.length) return lower;
  let out = "";
  for (const ch of s) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}
function enumerateMatches(runs, query) {
  if (query.length === 0) return [];
  const runStart = Array(runs.length);
  let text = "";
  for (let i = 0; i < runs.length; i++) {
    runStart[i] = text.length;
    text += runs[i]?.text ?? "";
  }
  const haystack = foldCase(text);
  const needle = foldCase(query);
  const matches = [];
  let from = 0;
  for (; ; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const slices = offsetsToSlices(runStart, runs, at, at + needle.length);
    matches.push({
      text: slices.map((s) => runs[s.runIndex]?.text.slice(s.start, s.end) ?? "").join(""),
      slices
    });
    from = at + needle.length;
  }
  return matches;
}
function offsetsToSlices(runStart, runs, start, end) {
  let lo = 0;
  let hi = runStart.length - 1;
  while (lo < hi) {
    const mid = lo + hi + 1 >> 1;
    if ((runStart[mid] ?? 0) <= start) lo = mid;
    else hi = mid - 1;
  }
  const slices = [];
  let pos = start;
  let run = lo;
  while (pos < end && run < runs.length) {
    const base = runStart[run] ?? 0;
    const runEnd = run + 1 < runs.length ? runStart[run + 1] ?? base : base + (runs[run]?.text.length ?? 0);
    const sliceEnd = Math.min(end, runEnd);
    const localStart = pos - base;
    const localEnd = sliceEnd - base;
    if (localEnd > localStart) {
      slices.push({ runIndex: run, start: localStart, end: localEnd });
    }
    pos = sliceEnd;
    run++;
  }
  return slices;
}
function createMeasureForFont() {
  let ctx = null;
  const perFont = /* @__PURE__ */ new Map();
  return (font) => {
    const cached = perFont.get(font);
    if (cached) return cached;
    const measure = (s) => {
      if (!ctx) {
        ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) return 0;
      }
      ctx.font = font;
      return ctx.measureText(s).width;
    };
    perFont.set(font, measure);
    return measure;
  };
}
var codePointCount = (s) => [...s].length;
function sliceBounds(runs, match, measureForFont) {
  const rects = [];
  for (const slice of match.slices) {
    const run = runs[slice.runIndex];
    if (!run) continue;
    const measure = measureForFont(run.font);
    const start = Math.max(0, Math.min(slice.start, run.text.length));
    const end = Math.max(start, Math.min(slice.end, run.text.length));
    const spacing = run.letterSpacingPx ?? 0;
    const prefixGlyphs = codePointCount(run.text.slice(0, start));
    const sliceGlyphs = codePointCount(run.text.slice(start, end));
    const x = measure(run.text.slice(0, start)) + prefixGlyphs * spacing;
    const width = measure(run.text.slice(start, end)) + Math.max(0, sliceGlyphs - 1) * spacing;
    if (width <= 0) continue;
    rects.push({ x: run.x + x, y: run.y, width, height: run.h });
  }
  return rects;
}

// packages/viewer-docx/src/zipHygiene.ts
import JSZip from "jszip";
var MAX_ZIP_SIZE = 100 * 1024 * 1024;
var MAX_ENTRY_COUNT = 1e4;
var MAX_ENTRY_SIZE = 50 * 1024 * 1024;
var MAX_EXPANSION_RATIO = 100;
var MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;
async function validateZip(data) {
  if (data.byteLength > MAX_ZIP_SIZE) {
    return { valid: false, error: `ZIP size ${data.byteLength} exceeds max ${MAX_ZIP_SIZE}` };
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return { valid: false, error: "Invalid ZIP file" };
  }
  const files = Object.values(zip.files);
  if (files.length > MAX_ENTRY_COUNT) {
    return { valid: false, error: `ZIP entry count ${files.length} exceeds max ${MAX_ENTRY_COUNT}` };
  }
  let totalUncompressed = 0;
  for (const file of files) {
    if (!file) continue;
    if (file.name.includes("..")) {
      return { valid: false, error: `Path traversal detected: ${file.name}` };
    }
    if (file.dir) continue;
    const meta = file._data;
    if (!meta) {
      return { valid: false, error: `Cannot verify size of entry "${file.name}"` };
    }
    const { uncompressedSize = 0, compressedSize = 0 } = meta;
    if (uncompressedSize > MAX_ENTRY_SIZE) {
      return {
        valid: false,
        error: `Entry "${file.name}" uncompressed size ${uncompressedSize} exceeds max ${MAX_ENTRY_SIZE}`
      };
    }
    if (uncompressedSize > 0) {
      if (compressedSize <= 0 || uncompressedSize / compressedSize > MAX_EXPANSION_RATIO) {
        const ratio = compressedSize > 0 ? (uncompressedSize / compressedSize).toFixed(1) : "\u221E";
        return {
          valid: false,
          error: `Entry "${file.name}" expansion ratio ${ratio} exceeds max ${MAX_EXPANSION_RATIO}`
        };
      }
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      return {
        valid: false,
        error: `Total uncompressed size exceeds max ${MAX_TOTAL_UNCOMPRESSED}`
      };
    }
  }
  return { valid: true };
}

// packages/viewer-docx/src/DocxAdapter.ts
var MAX_DOCX_PAGES = 1e4;
var DOCX_RENDER_TIMEOUT = 3e4;
var FIND_TIMEOUT = 8e3;
var THUMBNAIL_TIMEOUT = 15e3;
var BASE_CAPABILITIES = {
  pageCount: true,
  textSearch: true,
  textSelection: true,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: true
};
function capabilitiesFor(options) {
  return { ...BASE_CAPABILITIES, thumbnails: options.thumbnails ?? false };
}
var DocxAdapter = class {
  capabilities;
  thumbnailsEnabled;
  wasmUrl;
  doc = null;
  viewer = null;
  container = null;
  scroller = null;
  nativeSizes = [];
  loadedDoc = null;
  currentZoom = 1;
  viewportCbs = /* @__PURE__ */ new Set();
  resizeObserver = null;
  scrollListener = null;
  // Bumped on teardown so a load or search that resolves late can tell its
  // document has been torn down and must not touch adapter state.
  generation = 0;
  // Per-page text runs in native (scale-1) CSS px, shared by search geometry.
  runsCache = /* @__PURE__ */ new Map();
  measureForFont = createMeasureForFont();
  // Interactive search state: the query the engine currently holds and the
  // ordinal the engine's cursor sits on (-1 = none). searchSeq makes the state
  // commit last-search-wins: a superseded or timed-out search resolving late
  // must not replace it (it would freeze stepping by zeroing matchCount).
  // Activations are serialised through activationChain, with activateSeq
  // collapsing queued bursts to the latest target.
  activeQuery = null;
  engineCursor = -1;
  matchCount = 0;
  searchSeq = 0;
  activateSeq = 0;
  activationChain = Promise.resolve();
  // Cancellers for in-flight find/search requests so teardown settles them
  // (with []) immediately instead of leaving work running on a dead adapter.
  pendingFinds = /* @__PURE__ */ new Set();
  // Teardown hook for an in-flight load() so destroy()/abort settles it.
  activeLoad = null;
  constructor(options = {}) {
    this.thumbnailsEnabled = options.thumbnails ?? false;
    this.wasmUrl = options.wasmUrl;
    this.capabilities = capabilitiesFor(options);
  }
  async load(source, mount, opts) {
    const signal = opts.signal;
    if (signal?.aborted)
      throw new DOMException("DOCX load cancelled", "AbortError");
    const data = source.data instanceof ArrayBuffer ? source.data : await source.data.arrayBuffer();
    if (signal?.aborted)
      throw new DOMException("DOCX load cancelled", "AbortError");
    const result = await validateZip(data);
    if (!result.valid) {
      throw createError2(
        "SECURITY_ERROR",
        result.error ?? "Invalid DOCX archive",
        { format: "docx" }
      );
    }
    let cancelLoad;
    const cancellation = new Promise((_, reject) => {
      cancelLoad = reject;
    });
    const loadHandle = { cancel: cancelLoad };
    this.activeLoad = loadHandle;
    const timer = setTimeout(
      () => cancelLoad(
        createError2("TIMEOUT", "DOCX render timed out after 30 seconds", {
          format: "docx"
        })
      ),
      DOCX_RENDER_TIMEOUT
    );
    const onAbort = () => cancelLoad(new DOMException("DOCX load cancelled", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    const pipeline = this.runLoad(data, mount, opts);
    pipeline.catch(() => {
    });
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
  async runLoad(data, mount, opts) {
    const generation = this.generation;
    const doc = await DocxDocument.load(data, {
      mode: "worker",
      ...opts.password !== void 0 ? { password: opts.password } : {},
      ...this.wasmUrl !== void 0 ? { wasmUrl: this.wasmUrl } : {}
    });
    if (generation !== this.generation) {
      doc.destroy();
      throw createError2("WORKER_TERMINATED", "DOCX load cancelled", {
        format: "docx"
      });
    }
    this.doc = doc;
    await doc.waitUntilLayoutComplete();
    if (generation !== this.generation) {
      throw createError2("WORKER_TERMINATED", "DOCX load cancelled", {
        format: "docx"
      });
    }
    const pageCount = Math.min(Math.max(1, doc.pageCount), MAX_DOCX_PAGES);
    this.nativeSizes = Array.from({ length: pageCount }, (_, i) => {
      const size = doc.pageSize(i);
      return {
        width: size.widthPt * PT_TO_PX,
        height: size.heightPt * PT_TO_PX
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
      }
    });
    this.scroller = null;
    this.scrollListener = () => this.notifyViewport();
    container.addEventListener("scroll", this.scrollListener, {
      capture: true,
      passive: true
    });
    this.resizeObserver = new ResizeObserver(() => this.notifyViewport());
    this.resizeObserver.observe(container);
    this.currentZoom = this.viewer.getScale();
    this.loadedDoc = {
      pageCount,
      pages: this.nativeSizes.map((dimensions, index) => ({
        index,
        dimensions,
        rotation: 0
      }))
    };
    this.notifyViewport();
    return this.loadedDoc;
  }
  destroy() {
    if (this.activeLoad) {
      this.activeLoad.cancel(
        createError2("WORKER_TERMINATED", "DOCX load cancelled", {
          format: "docx"
        })
      );
      this.activeLoad = null;
    }
    for (const cancel of [...this.pendingFinds]) cancel();
    this.teardownDocument();
    this.loadedDoc = null;
  }
  teardownDocument() {
    this.generation++;
    if (this.container && this.scrollListener) {
      this.container.removeEventListener("scroll", this.scrollListener, {
        capture: true
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
  setZoom(scale) {
    if (!this.viewer) return;
    if (scale === "fit-width") this.viewer.fitWidth();
    else if (scale === "fit-page") this.viewer.fitPage();
    else this.viewer.setScale(scale);
    this.currentZoom = this.viewer.getScale();
    this.notifyViewport();
  }
  getZoom() {
    return this.currentZoom;
  }
  /** The engine's scroll host, resolved lazily: it is created and styled by
   * the viewer after mount, so the first load-time probe can miss it. Cached
   * once a real (non-fallback) host is found. */
  getScroller() {
    if (!this.container) return null;
    if (this.scroller && this.scroller !== this.container && this.scroller.isConnected) {
      return this.scroller;
    }
    const host = findScrollHost(this.container);
    if (host !== this.container) this.scroller = host;
    return host;
  }
  getViewport() {
    const scroller = this.getScroller();
    if (!scroller || this.nativeSizes.length === 0) return null;
    return computeViewportMetrics(scroller, this.nativeSizes, this.currentZoom);
  }
  subscribeViewport(callback) {
    this.viewportCbs.add(callback);
    if (this.container) queueMicrotask(callback);
    return () => {
      this.viewportCbs.delete(callback);
    };
  }
  notifyViewport() {
    for (const cb of this.viewportCbs) cb();
  }
  goToPage(n) {
    if (!this.viewer) return;
    const index = Math.min(
      Math.max(0, n - 1),
      Math.max(0, this.nativeSizes.length - 1)
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
  findMatches(query) {
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
  search(query) {
    if (!this.viewer || !query.trim())
      return createAsyncIterable([]);
    const seq = ++this.searchSeq;
    const reply = this.raceFind(
      (token) => this.runInteractiveSearch(query, seq, token)
    );
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            const items = await reply;
            const value = items[i];
            if (i < items.length && value !== void 0) {
              i++;
              return { value, done: false };
            }
            return { value: void 0, done: true };
          }
        };
      }
    };
  }
  async runInteractiveSearch(query, seq, token) {
    const viewer = this.viewer;
    if (!viewer) return [];
    const generation = this.generation;
    const found = await viewer.findText(query);
    if (generation !== this.generation || seq !== this.searchSeq || token.stale) {
      return [];
    }
    this.activeQuery = query;
    this.engineCursor = -1;
    this.matchCount = found.length;
    this.activateSeq++;
    return this.attachBounds(found, query);
  }
  /** Pair the engine's matches (no geometry) with a local enumeration of the
   * same runs by per-page ordinal. Both scans use identical fold/scan
   * semantics, so ordinals line up; if they ever diverge the match degrades to
   * empty bounds (consumers then skip navigation) rather than mis-anchoring. */
  async attachBounds(found, query) {
    const generation = this.generation;
    const perPageOrdinal = /* @__PURE__ */ new Map();
    const results = [];
    for (const match of found) {
      const page = match.location.page;
      const ordinal = perPageOrdinal.get(page) ?? 0;
      perPageOrdinal.set(page, ordinal + 1);
      let bounds = [];
      const runs = await this.pageRuns(page);
      if (generation !== this.generation) return [];
      const local = enumerateMatches(runs, query)[ordinal];
      if (local) bounds = sliceBounds(runs, local, this.measureForFont);
      results.push({ pageIndex: page, text: match.text, bounds });
    }
    return results;
  }
  async enumerateAllPages(query) {
    const generation = this.generation;
    const results = [];
    for (let page = 0; page < this.nativeSizes.length; page++) {
      const runs = await this.pageRuns(page);
      if (generation !== this.generation) return [];
      for (const match of enumerateMatches(runs, query)) {
        results.push({
          pageIndex: page,
          text: match.text,
          bounds: sliceBounds(runs, match, this.measureForFont)
        });
      }
    }
    return results;
  }
  /** Text runs for a page in native (scale-1) CSS px, cached per document. */
  pageRuns(page) {
    const cached = this.runsCache.get(page);
    if (cached) return cached;
    const doc = this.doc;
    const native = this.nativeSizes[page];
    if (!doc || !native) return Promise.resolve([]);
    const runs = doc.collectPageRuns(page, { width: native.width }).catch(() => []);
    this.runsCache.set(page, runs);
    return runs;
  }
  // Race a find/search against the shared timeout, registered so teardown
  // settles in-flight requests with [] instead of leaving work running. The
  // token tells the work it has been settled early (timeout/teardown), so it
  // must not commit interactive state.
  raceFind(work) {
    const token = { stale: false };
    return new Promise((resolve) => {
      let done = false;
      const settle = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.pendingFinds.delete(cancel);
        resolve(value);
      };
      const cancel = () => {
        token.stale = true;
        settle([]);
      };
      const timer = setTimeout(cancel, FIND_TIMEOUT);
      this.pendingFinds.add(cancel);
      work(token).then(settle, () => settle([]));
    });
  }
  clearSearch() {
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
  setActiveSearchMatch(index) {
    if (!this.viewer || this.activeQuery === null) return Promise.resolve();
    const seq = ++this.activateSeq;
    this.activationChain = this.activationChain.then(
      () => this.runActivation(seq, index).catch(() => {
      })
    );
    return this.activationChain;
  }
  async runActivation(seq, index) {
    if (seq !== this.activateSeq) return;
    const viewer = this.viewer;
    const query = this.activeQuery;
    if (!viewer || query === null) return;
    if (index === null) {
      await viewer.findText(query).catch(() => {
      });
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
    const scroller = this.getScroller();
    const resting = scroller ? { left: scroller.scrollLeft, top: scroller.scrollTop } : null;
    for (let i = 0; i < steps; i++) {
      if (seq !== this.activateSeq || this.viewer !== viewer) return;
      const stepped = await (useNext ? viewer.findNext() : viewer.findPrev()).catch(() => null);
      if (scroller && resting) {
        if (typeof scroller.scrollTo === "function") {
          scroller.scrollTo({ ...resting, behavior: "auto" });
        } else {
          scroller.scrollLeft = resting.left;
          scroller.scrollTop = resting.top;
        }
      }
      if (!stepped) return;
      this.engineCursor = stepped.matchIndex;
    }
  }
  /** Scroll so `rect` (native units, top-left origin) on `pageIndex` is
   * visible, with the core's align/centre semantics. */
  async scrollToRect(pageIndex, rect, opts = {}) {
    const scroller = this.getScroller();
    const metrics = this.getViewport();
    if (!metrics || !scroller) return;
    const target = computeScrollTarget(
      metrics,
      pageIndex,
      rect,
      opts.align ?? "center"
    );
    if (!target) return;
    scroller.scrollTo({
      left: target.left,
      top: target.top,
      behavior: opts.behavior ?? "smooth"
    });
  }
  async getThumbnail(page, maxPx) {
    if (!this.thumbnailsEnabled) {
      throw new Error("DOCX thumbnails are not enabled");
    }
    const doc = this.doc;
    if (!doc || this.nativeSizes.length === 0) {
      throw new Error("DOCX document not loaded");
    }
    const index = Math.min(
      Math.max(0, page - 1),
      this.nativeSizes.length - 1
    );
    const native = this.nativeSizes[index];
    if (!native) throw new Error("DOCX document not loaded");
    const width = native.width >= native.height ? maxPx : Math.max(1, Math.round(maxPx * native.width / native.height));
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("DOCX thumbnail timed out")),
        THUMBNAIL_TIMEOUT
      );
    });
    try {
      return await Promise.race([
        doc.renderPageToBitmap(index, { width, dpr: 1 }),
        timeout
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  /** External links are filtered to http/https/mailto and relayed to the host
   * as a `link-click` window message (never navigated — same contract as the
   * pre-3.0 iframe relay). Internal bookmark links scroll within the document. */
  handleHyperlink(target) {
    if (target.kind === "external") {
      const url = normalizeLinkTarget(target.url);
      if (url === null) return;
      window.postMessage(
        { type: "link-click", url },
        window.location.origin
      );
      return;
    }
    const page = this.doc?.getBookmarkPage(target.ref);
    if (page !== void 0) this.viewer?.scrollToPage(page);
  }
};
function createDocxAdapterFactory(options = {}) {
  return {
    format: "docx",
    capabilities: capabilitiesFor(options),
    create: () => new DocxAdapter(options)
  };
}
function createAsyncIterable(items) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          const value = items[i];
          if (i < items.length && value !== void 0) {
            i++;
            return { value, done: false };
          }
          return { value: void 0, done: true };
        }
      };
    }
  };
}
export {
  DocxAdapter,
  createDocxAdapterFactory
};
//# sourceMappingURL=index.js.map