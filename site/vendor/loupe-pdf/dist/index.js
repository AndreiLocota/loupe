// packages/viewer-pdf/src/PdfAdapter.ts
import {
  computeScrollTarget,
  createError
} from "@veridox-ai/loupe-core";
import {
  AnnotationMode,
  GlobalWorkerOptions,
  getDocument,
  Util
} from "pdfjs-dist";
function toHexColor(c) {
  if (!c || c.length < 3) return void 0;
  const h = (n) => (n ?? 0).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}
var TEXT_LAYER_FONT = "sans-serif";
var DEFAULT_ASCENT = 0.8;
var SEARCH_HIGHLIGHT_CLASS = "loupe-search-highlight";
var SEARCH_HIGHLIGHT_ACTIVE_CLASS = "loupe-search-highlight-active";
var HIGHLIGHT_BASE_BACKGROUND = "rgba(255,212,0,0.45)";
var HIGHLIGHT_ACTIVE_BACKGROUND = "rgba(255,140,0,0.6)";
var HIGHLIGHT_ACTIVE_OUTLINE = "2px solid rgba(230,120,0,0.9)";
var MIN_SCALE = 0.1;
var measureCtx;
var cachedAscentRatio = 0;
function getTextMeasureCtx() {
  if (measureCtx === void 0) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}
function getAscentRatio(ctx) {
  if (cachedAscentRatio) return cachedAscentRatio;
  ctx.font = `100px ${TEXT_LAYER_FONT}`;
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? 0;
  const descent = Math.abs(m.fontBoundingBoxDescent ?? 0);
  cachedAscentRatio = ascent && ascent + descent ? ascent / (ascent + descent) : DEFAULT_ASCENT;
  return cachedAscentRatio;
}
var WORKER_SRC = new URL("./workers/pdf.worker.js", import.meta.url).href;
var ALLOWED_LINK_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
var CAPABILITIES = {
  pageCount: true,
  textSearch: true,
  textSelection: true,
  thumbnails: true,
  rotation: true,
  layers: true,
  annotations: true,
  viewport: true,
  scrollToRect: true
};
var PdfAdapter = class {
  capabilities = CAPABILITIES;
  mountElement = null;
  scrollContainer = null;
  pdfDoc = null;
  loadingTask = null;
  defaultPageWidth = 612;
  defaultPageHeight = 792;
  pageSlots = [];
  scale = 1.5;
  // Remembered so a fit mode can be re-applied when the container is resized
  // (or when its first laid-out size differs from the size at load time).
  zoomMode = "fit-width";
  observer = null;
  resizeObserver = null;
  // Tail of the thumbnail render chain (see getThumbnail).
  thumbnailQueue = Promise.resolve();
  lastFitWidth = 0;
  lastFitHeight = 0;
  abortController = new AbortController();
  loadedDoc = null;
  ocConfig = null;
  annotationsVisible = true;
  rotation = 0;
  searchMatches = [];
  currentSearchQuery = "";
  // Yield-order index of the emphasised match (the store's active index).
  activeMatchIndex = null;
  // Per-page native (un-rotated, scale-1) sizes; null until measured. Seeded
  // with page 1's size as an estimate so every slot can be pre-sized — see
  // applySlotSize.
  pageNativeSizes = [];
  // Resolves when the background measurement pass has replaced every estimate
  // with the real page size (or the load was torn down). Precise scrolling
  // awaits it so offsets are computed against settled layout.
  layoutReady = Promise.resolve();
  resolveLayoutReady = () => {
  };
  layoutSettled = false;
  // Latest goToPage target, so its one post-measurement correction can be
  // dropped when a newer navigation (page or rect) supersedes it.
  lastNavPage = null;
  workerSrc;
  viewportCbs = /* @__PURE__ */ new Set();
  fireViewport = () => {
    for (const cb of this.viewportCbs) cb();
  };
  constructor(workerSrc) {
    this.workerSrc = workerSrc || WORKER_SRC;
  }
  async load(source, mount, opts) {
    this.mountElement = mount;
    this.abortController = new AbortController();
    GlobalWorkerOptions.workerSrc = this.workerSrc;
    const ensureLive = () => {
      if (opts.signal?.aborted) {
        this.destroy();
        throw new DOMException("PDF load cancelled", "AbortError");
      }
    };
    const data = source.data instanceof ArrayBuffer ? { data: source.data } : { data: await source.data.arrayBuffer() };
    ensureLive();
    const loadingTask = getDocument({
      ...data,
      ...opts.password !== void 0 ? { password: opts.password } : {},
      disableAutoFetch: false
    });
    this.loadingTask = loadingTask;
    try {
      this.pdfDoc = await loadingTask.promise;
    } catch (err) {
      if (err?.name === "PasswordException") {
        throw createError(
          "PASSWORD_REQUIRED",
          "This PDF is password-protected",
          { format: "pdf" }
        );
      }
      throw err;
    }
    ensureLive();
    const pageCount = this.pdfDoc.numPages;
    try {
      this.ocConfig = await this.pdfDoc.getOptionalContentConfig();
    } catch {
      this.ocConfig = null;
    }
    ensureLive();
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
    }
    const pages = Array.from({ length: pageCount }, (_, i) => ({
      index: i,
      dimensions: { width: defaultWidth, height: defaultHeight },
      rotation: 0
    }));
    ensureLive();
    this.pageNativeSizes = Array.from({ length: pageCount }, () => null);
    this.pageNativeSizes[0] = { w: defaultWidth, h: defaultHeight };
    this.layoutSettled = false;
    this.layoutReady = new Promise((resolve) => {
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
  destroy() {
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
    this.layoutSettled = true;
    this.resolveLayoutReady();
  }
  getZoom() {
    return this.scale;
  }
  goToPage(n) {
    const slot = this.pageSlots[n - 1];
    const sc = this.scrollContainer;
    if (!slot || !sc) return;
    this.lastNavPage = n;
    sc.scrollTo({ top: slot.container.offsetTop - 8, behavior: "smooth" });
    if (!this.layoutSettled) {
      void this.layoutReady.then(() => {
        if (this.lastNavPage !== n || !this.scrollContainer) return;
        this.scrollContainer.scrollTo({
          top: slot.container.offsetTop - 8,
          behavior: "auto"
        });
      });
    }
  }
  async scrollToRect(pageIndex, rect, opts = {}) {
    this.lastNavPage = null;
    await this.layoutReady;
    const sc = this.scrollContainer;
    const metrics = this.getViewport();
    if (!sc || !metrics) return;
    const target = computeScrollTarget(
      metrics,
      pageIndex,
      rect,
      opts.align ?? "center"
    );
    if (!target) return;
    sc.scrollTo({
      left: target.left,
      top: target.top,
      behavior: opts.behavior ?? "smooth"
    });
  }
  setZoom(scale) {
    this.zoomMode = scale;
    const fitBox = this.scrollContainer ?? this.mountElement;
    const rotated = this.rotation % 180 !== 0;
    const pageW = rotated ? this.defaultPageHeight : this.defaultPageWidth;
    const pageH = rotated ? this.defaultPageWidth : this.defaultPageHeight;
    if (typeof scale === "number") {
      this.scale = Math.max(MIN_SCALE, scale);
    } else if (scale === "fit-width" && fitBox && fitBox.clientWidth > 0 && pageW > 0) {
      this.lastFitWidth = fitBox.clientWidth;
      this.scale = Math.max(MIN_SCALE, (fitBox.clientWidth - 32) / pageW);
    } else if (scale === "fit-page" && fitBox && fitBox.clientWidth > 0 && fitBox.clientHeight > 0 && pageH > 0) {
      this.lastFitHeight = fitBox.clientHeight;
      this.scale = Math.max(MIN_SCALE, (fitBox.clientHeight - 32) / pageH);
    }
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
  applySlotSize(i) {
    const slot = this.pageSlots[i];
    if (!slot) return;
    const size = this.pageNativeSizes[i];
    const w = size?.w ?? this.defaultPageWidth;
    const h = size?.h ?? this.defaultPageHeight;
    const rotated = this.rotation % 180 !== 0;
    slot.container.style.width = (rotated ? h : w) * this.scale + "px";
    slot.container.style.height = (rotated ? w : h) * this.scale + "px";
  }
  applyAllSlotSizes() {
    for (let i = 0; i < this.pageSlots.length; i++) this.applySlotSize(i);
  }
  /**
   * Resolve every page's native size in the background so container offsets
   * become exact for mixed-size documents, then resolve layoutReady (which
   * precise scrolling awaits). Runs after load(); estimates from page 1 are
   * already applied synchronously, so this only corrects the outliers.
   */
  async measureAllPages() {
    const doc = this.pdfDoc;
    const signal = this.abortController.signal;
    const settle = this.resolveLayoutReady;
    const isCurrent = () => !signal.aborted && this.pdfDoc === doc;
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
          continue;
        }
        if (i % 20 === 19) await new Promise((r) => setTimeout(r));
      }
      if (isCurrent()) {
        this.layoutSettled = true;
        this.fireViewport();
      }
    } finally {
      settle();
    }
  }
  getViewport() {
    const sc = this.scrollContainer;
    if (!sc) return null;
    const rotated = this.rotation % 180 !== 0;
    const pages = this.pageSlots.map((slot) => {
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
        nativeHeight: (rotated ? w : h) / this.scale
      };
    });
    return {
      scale: this.scale,
      rotation: (this.rotation % 360 + 360) % 360,
      scroll: { x: sc.scrollLeft, y: sc.scrollTop },
      content: { width: sc.scrollWidth, height: sc.scrollHeight },
      client: { width: sc.clientWidth, height: sc.clientHeight },
      devicePixelRatio: typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1,
      // PDF user space is 1/72 inch; a content pixel at scale 1 is one point.
      unit: "pt",
      pages
    };
  }
  subscribeViewport(callback) {
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
  async findMatches(query) {
    const q = query.trim();
    if (!this.pdfDoc || !q) return [];
    const lower = q.toLowerCase();
    const out = [];
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      if (this.abortController.signal.aborted) break;
      const page = await this.pdfDoc.getPage(pageNum);
      const nativeH = page.getViewport({ scale: 1 }).height;
      const tc = await page.getTextContent();
      const items = tc.items.filter(
        (i) => "str" in i && Boolean(i.str)
      );
      for (const item of items) {
        const str = item.str.toLowerCase();
        let idx = str.indexOf(lower);
        while (idx >= 0) {
          out.push({
            pageIndex: pageNum - 1,
            text: item.str.substring(idx, idx + q.length),
            bounds: [this.matchBounds(item, idx, q.length, nativeH)]
          });
          idx = str.indexOf(lower, idx + q.length);
        }
      }
    }
    return out;
  }
  /**
   * Narrow a text run's box to just the matched substring, proportionally
   * (text-content items can span a whole line, so the full run reads as a
   * wildly over-wide highlight). Approximate for proportional fonts, but far
   * tighter than the whole run. Native PDF points, flipped from the PDF's
   * bottom-left origin to top-left via the page height.
   */
  matchBounds(item, idx, queryLen, nativeH) {
    const len = item.str.length || 1;
    const originX = item.transform[4] ?? 0;
    const baselineY = item.transform[5] ?? 0;
    return {
      x: originX + item.width * idx / len,
      // baseline + font height ≈ glyph top in bottom-left space.
      y: nativeH - (baselineY + item.height),
      width: item.width * queryLen / len,
      height: item.height
    };
  }
  search(query) {
    this.clearSearchHighlights();
    this.searchMatches = [];
    this.currentSearchQuery = query;
    this.activeMatchIndex = null;
    if (!this.pdfDoc || !query.trim()) {
      return createAsyncIterable([]);
    }
    const self = this;
    const pdfDoc = this.pdfDoc;
    return {
      [Symbol.asyncIterator]() {
        let pageNum = 1;
        let currentPage = null;
        let items = [];
        let itemIdx = 0;
        let searchFrom = 0;
        let nativeH = 0;
        const lowerQuery = query.toLowerCase();
        let done = false;
        return {
          async next() {
            while (!done) {
              if (!currentPage && pageNum <= pdfDoc.numPages) {
                currentPage = await pdfDoc.getPage(pageNum);
                nativeH = currentPage.getViewport({ scale: 1 }).height;
                const tc = await currentPage.getTextContent();
                items = tc.items.filter(
                  (i) => "str" in i && i.str
                );
                itemIdx = 0;
                searchFrom = 0;
              }
              while (itemIdx < items.length) {
                const item = items[itemIdx];
                if (!item) break;
                const str = item.str.toLowerCase();
                const at = str.indexOf(lowerQuery, searchFrom);
                if (at >= 0) {
                  searchFrom = at + lowerQuery.length;
                  self.searchMatches.push({ pageIndex: pageNum - 1, query });
                  return {
                    value: {
                      pageIndex: pageNum - 1,
                      text: item.str.substring(at, at + query.length),
                      bounds: [
                        self.matchBounds(item, at, query.length, nativeH)
                      ]
                    },
                    done: false
                  };
                }
                itemIdx++;
                searchFrom = 0;
              }
              pageNum++;
              currentPage = null;
              items = [];
              if (pageNum > pdfDoc.numPages) {
                done = true;
                self.highlightCurrentSearch();
              }
            }
            return { value: void 0, done: true };
          }
        };
      }
    };
  }
  clearSearch() {
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
  setActiveSearchMatch(index) {
    this.activeMatchIndex = index;
    for (const slot of this.pageSlots) this.applyActiveStyle(slot);
  }
  async getThumbnail(page, maxPx) {
    if (!this.pdfDoc) throw new Error("No document loaded");
    const run = this.thumbnailQueue.then(
      () => this.renderThumbnail(page, maxPx)
    );
    this.thumbnailQueue = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  }
  async renderThumbnail(page, maxPx) {
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
        rotation: this.rotation
      }),
      annotationMode: this.annotationsVisible ? AnnotationMode.ENABLE : AnnotationMode.DISABLE,
      ...this.ocConfig ? { optionalContentConfigPromise: Promise.resolve(this.ocConfig) } : {}
    }).promise;
    return createImageBitmap(canvas);
  }
  getLayers() {
    if (!this.ocConfig) return [];
    const layers = [];
    for (const [id, group] of this.ocConfig) {
      layers.push({ id, name: group.name || id, visible: group.visible });
    }
    return layers;
  }
  setLayerVisibility(id, visible) {
    if (!this.ocConfig) return;
    this.ocConfig.setVisibility(id, visible);
    this.renderVisible();
  }
  getAnnotationsVisible() {
    return this.annotationsVisible;
  }
  setAnnotationsVisible(visible) {
    if (this.annotationsVisible === visible) return;
    this.annotationsVisible = visible;
    this.renderVisible();
  }
  getRotation() {
    return this.rotation;
  }
  setRotation(degrees) {
    const normalized = (Math.round(degrees / 90) * 90 % 360 + 360) % 360;
    if (normalized === this.rotation) return;
    this.rotation = normalized;
    this.setZoom(this.zoomMode);
  }
  async getAnnotations() {
    if (!this.pdfDoc) return [];
    const out = [];
    for (let p = 1; p <= this.pdfDoc.numPages; p++) {
      const page = await this.pdfDoc.getPage(p);
      const raw = await page.getAnnotations();
      for (const a of raw) {
        if (a.subtype === "Popup") continue;
        const ann = {
          id: String(a.id ?? `${p}-${out.length}`),
          pageIndex: p - 1,
          subtype: a.subtype ?? "Unknown",
          rect: [
            a.rect?.[0] ?? 0,
            a.rect?.[1] ?? 0,
            a.rect?.[2] ?? 0,
            a.rect?.[3] ?? 0
          ]
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
  buildDom(pageCount) {
    if (!this.mountElement) return;
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "loupe-pdf-scroll";
    this.scrollContainer.style.cssText = "overflow:auto;width:100%;height:100%;position:relative;";
    this.scrollContainer.addEventListener("scroll", this.fireViewport, {
      passive: true,
      signal: this.abortController.signal
    });
    this.mountElement.innerHTML = "";
    this.mountElement.appendChild(this.scrollContainer);
    this.pageSlots = [];
    for (let i = 0; i < pageCount; i++) {
      const container = document.createElement("div");
      container.className = "loupe-pdf-page";
      container.style.cssText = "position:relative;margin:8px auto;overflow:hidden;";
      container.dataset.pageNum = String(i + 1);
      const canvas = document.createElement("canvas");
      container.appendChild(canvas);
      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "loupe-pdf-text-layer";
      textLayerDiv.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:auto;user-select:text;cursor:text;";
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
        renderTask: null
      });
      this.applySlotSize(i);
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const slot = this.pageSlots.find(
              (s) => s.container === entry.target
            );
            if (slot && !slot.rendered) {
              this.renderPageSlot(slot);
            }
          }
        }
      },
      { root: this.scrollContainer, rootMargin: "200px 0px" }
    );
    for (const slot of this.pageSlots) {
      this.observer.observe(slot.container);
    }
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.fireViewport();
        if (typeof this.zoomMode === "number") return;
        const box = this.scrollContainer;
        if (!box) return;
        const w = box.clientWidth;
        const h = box.clientHeight;
        const changed = this.zoomMode === "fit-width" ? w !== this.lastFitWidth : h !== this.lastFitHeight;
        if (w > 0 && changed) {
          this.setZoom(this.zoomMode);
        }
      });
      this.resizeObserver.observe(this.scrollContainer);
    }
  }
  async renderPageSlot(slot) {
    if (!this.pdfDoc) return;
    const seq = ++slot.renderSeq;
    slot.renderTask?.cancel();
    slot.renderTask = null;
    slot.rendered = true;
    const signal = this.abortController.signal;
    try {
      const page = await this.pdfDoc.getPage(slot.pageNum);
      if (seq !== slot.renderSeq || signal.aborted) return;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({
        scale: this.scale * dpr,
        rotation: this.rotation
      });
      const logicalViewport = page.getViewport({
        scale: this.scale,
        rotation: this.rotation
      });
      slot.viewport = logicalViewport;
      slot.canvas.width = viewport.width;
      slot.canvas.height = viewport.height;
      slot.container.style.width = logicalViewport.width + "px";
      slot.container.style.height = logicalViewport.height + "px";
      slot.canvas.style.width = logicalViewport.width + "px";
      slot.canvas.style.height = logicalViewport.height + "px";
      this.fireViewport();
      const renderTask = page.render({
        canvas: slot.canvas,
        viewport,
        // Bake annotation appearances (markup, static form fields) into the
        // canvas only when the annotation layer is enabled. Links are handled
        // separately as a DOM overlay in renderTextLayer.
        annotationMode: this.annotationsVisible ? AnnotationMode.ENABLE : AnnotationMode.DISABLE,
        ...this.ocConfig ? { optionalContentConfigPromise: Promise.resolve(this.ocConfig) } : {}
      });
      slot.renderTask = renderTask;
      const onAbort = () => renderTask.cancel();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        await renderTask.promise;
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (slot.renderTask === renderTask) slot.renderTask = null;
      }
      if (seq !== slot.renderSeq || signal.aborted) return;
      await this.renderTextLayer(page, logicalViewport, slot);
      if (this.currentSearchQuery) this.highlightSlot(slot);
    } catch (err) {
      const name = err.name;
      if (name !== "AbortError" && name !== "RenderingCancelledException") {
        console.error("Failed to render page", slot.pageNum, err);
      }
    }
  }
  async renderTextLayer(page, viewport, slot) {
    const textContent = await page.getTextContent();
    slot.textLayerDiv.innerHTML = "";
    const ctx = getTextMeasureCtx();
    const ascentRatio = ctx ? getAscentRatio(ctx) : DEFAULT_ASCENT;
    for (const item of textContent.items) {
      if (!("str" in item) || item.str === "") continue;
      const tx = Util.transform(viewport.transform, item.transform);
      const angle = Math.atan2(tx[1], tx[0]);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      const fontAscent = fontHeight * ascentRatio;
      const left = angle === 0 ? tx[4] : tx[4] + fontAscent * Math.sin(angle);
      const top = angle === 0 ? tx[5] - fontAscent : tx[5] - fontAscent * Math.cos(angle);
      let scaleX = 1;
      if (ctx && item.width > 0) {
        ctx.font = `${fontHeight}px ${TEXT_LAYER_FONT}`;
        const measured = ctx.measureText(item.str).width;
        if (measured > 0) scaleX = item.width * viewport.scale / measured;
      }
      const span = document.createElement("span");
      span.textContent = item.str;
      span.style.cssText = `position:absolute;left:${left}px;top:${top}px;font-size:${fontHeight}px;font-family:${TEXT_LAYER_FONT};line-height:1;white-space:pre;color:transparent;cursor:text;transform-origin:0 0;transform:rotate(${angle}rad) scaleX(${scaleX});`;
      slot.textLayerDiv.appendChild(span);
    }
    if (!this.annotationsVisible) return;
    const annotations = await page.getAnnotations();
    for (const annot of annotations) {
      if (annot.subtype === "Link" && annot.url) {
        this.handlePdfLink(annot, viewport, slot);
      }
    }
  }
  handlePdfLink(annot, viewport, slot) {
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
    const tx = viewport.transform;
    const t0 = tx[0] ?? 0, t1 = tx[1] ?? 0, t2 = tx[2] ?? 0, t3 = tx[3] ?? 0, t4 = tx[4] ?? 0, t5 = tx[5] ?? 0;
    const left = t0 * (rect[0] ?? 0) + t2 * (rect[1] ?? 0) + t4;
    const top = t1 * (rect[0] ?? 0) + t3 * (rect[1] ?? 0) + t5;
    const right = t0 * (rect[2] ?? 0) + t2 * (rect[3] ?? 0) + t4;
    const bottom = t1 * (rect[2] ?? 0) + t3 * (rect[3] ?? 0) + t5;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = `position:absolute;left:${left}px;top:${Math.min(top, bottom)}px;width:${right - left}px;height:${Math.abs(bottom - top)}px;cursor:pointer;`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    slot.textLayerDiv.appendChild(link);
  }
  renderVisible() {
    for (const slot of this.pageSlots) {
      slot.rendered = false;
    }
    for (const slot of this.pageSlots) {
      const rect = slot.container.getBoundingClientRect();
      const scrollRect = this.scrollContainer?.getBoundingClientRect();
      if (!scrollRect) continue;
      if (rect.bottom >= scrollRect.top - 200 && rect.top <= scrollRect.bottom + 200) {
        this.renderPageSlot(slot);
      }
    }
  }
  clearSearchHighlights() {
    for (const slot of this.pageSlots) {
      slot.textLayerDiv.querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`).forEach((el) => el.remove());
    }
  }
  highlightCurrentSearch() {
    this.clearSearchHighlights();
    if (!this.currentSearchQuery) return;
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
  highlightSlot(slot) {
    slot.textLayerDiv.querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`).forEach((el) => el.remove());
    const query = this.currentSearchQuery;
    const lowerQuery = query.toLowerCase();
    if (!lowerQuery) return;
    const base = this.searchMatches.filter(
      (m) => m.pageIndex < slot.pageNum - 1
    ).length;
    let local = 0;
    const layerRect = slot.textLayerDiv.getBoundingClientRect();
    for (const span of slot.textLayerDiv.querySelectorAll("span")) {
      const textNode = span.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
      const lowerText = (textNode.textContent ?? "").toLowerCase();
      let from = lowerText.indexOf(lowerQuery);
      while (from >= 0) {
        const ordinal = base + local;
        local++;
        const range = document.createRange();
        range.setStart(textNode, from);
        range.setEnd(textNode, from + query.length);
        for (const rect of range.getClientRects()) {
          const box = document.createElement("div");
          box.className = SEARCH_HIGHLIGHT_CLASS;
          box.dataset.loupeMatch = String(ordinal);
          box.style.cssText = `position:absolute;pointer-events:none;background:${HIGHLIGHT_BASE_BACKGROUND};left:${rect.left - layerRect.left}px;top:${rect.top - layerRect.top}px;width:${rect.width}px;height:${rect.height}px;`;
          slot.textLayerDiv.appendChild(box);
        }
        from = lowerText.indexOf(lowerQuery, from + lowerQuery.length);
      }
    }
    this.applyActiveStyle(slot);
  }
  /** Toggle the active-match emphasis on one page's highlight boxes. */
  applyActiveStyle(slot) {
    const active = this.activeMatchIndex;
    const boxes = slot.textLayerDiv.querySelectorAll(
      `.${SEARCH_HIGHLIGHT_CLASS}`
    );
    for (const box of boxes) {
      const isActive = active !== null && box.dataset.loupeMatch === String(active);
      box.classList.toggle(SEARCH_HIGHLIGHT_ACTIVE_CLASS, isActive);
      box.style.background = isActive ? HIGHLIGHT_ACTIVE_BACKGROUND : HIGHLIGHT_BASE_BACKGROUND;
      box.style.outline = isActive ? HIGHLIGHT_ACTIVE_OUTLINE : "";
    }
  }
};
function createPdfAdapterFactory(workerSrc) {
  return {
    format: "pdf",
    capabilities: CAPABILITIES,
    create: () => new PdfAdapter(workerSrc)
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
  PdfAdapter,
  createPdfAdapterFactory
};
//# sourceMappingURL=index.js.map