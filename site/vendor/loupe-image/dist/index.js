// packages/viewer-image/src/ImageAdapter.ts
import { createError } from "@veridox-ai/loupe-core";
var TIFF_DECODE_TIMEOUT = 3e4;
var IMAGE_CAPABILITIES = {
  pageCount: false,
  textSearch: false,
  textSelection: false,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: false
};
var TIFF_CAPABILITIES = {
  pageCount: true,
  textSearch: false,
  textSelection: false,
  thumbnails: true,
  rotation: true,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: false
};
var MIN_SCALE = 0.1;
var ImageAdapter = class {
  mountElement = null;
  container = null;
  imgElement = null;
  displayElement = null;
  format = "native";
  frames = [];
  currentFrame = 0;
  _capabilities = IMAGE_CAPABILITIES;
  scale = 1;
  // The requested zoom (mode or number), so fit modes can be re-applied when
  // the container is resized or becomes visible.
  zoomMode = 1;
  resizeObserver = null;
  lastFitWidth = 0;
  lastFitHeight = 0;
  rotation = 0;
  flipH = false;
  flipV = false;
  naturalW = 0;
  naturalH = 0;
  worker = null;
  tiffWorkerUrl;
  viewportCbs = /* @__PURE__ */ new Set();
  fireViewport = () => {
    for (const cb of this.viewportCbs) cb();
  };
  // Reject handle for an in-flight load so destroy()/abort can settle a promise
  // that would otherwise hang (e.g. a TIFF decode whose worker is terminated).
  pendingReject = null;
  constructor(options = {}) {
    this.tiffWorkerUrl = options.tiffWorkerUrl;
  }
  get capabilities() {
    return this._capabilities;
  }
  async load(source, mount, opts) {
    this.mountElement = mount;
    const signal = opts.signal;
    if (signal?.aborted) throw new DOMException("Image load cancelled", "AbortError");
    const data = await this.toArrayBuffer(source.data);
    if (signal?.aborted) throw new DOMException("Image load cancelled", "AbortError");
    this.format = this.detectImageFormat(new Uint8Array(data));
    if (this.format === "svg") {
      return this.loadSvg(data, mount, signal);
    }
    if (this.format === "tiff") {
      this._capabilities = TIFF_CAPABILITIES;
      return this.loadTiff(data, mount, signal);
    }
    if (this.format === "heic") {
      return this.loadHeic(data, mount, signal);
    }
    return this.loadNative(data, mount, signal);
  }
  destroy() {
    if (this.pendingReject) {
      this.pendingReject(createError("WORKER_TERMINATED", "Image load cancelled"));
      this.pendingReject = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.removeImage();
    this.frames = [];
    this.currentFrame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.container?.remove();
    this.container = null;
    this.mountElement = null;
  }
  setZoom(scale) {
    this.zoomMode = scale;
    const box = this.container ?? this.mountElement;
    const rotated = this.rotation % 180 !== 0;
    const w = rotated ? this.naturalH : this.naturalW;
    const h = rotated ? this.naturalW : this.naturalH;
    if (typeof scale === "number") {
      this.scale = scale;
    } else if (scale === "fit-width" && box && box.clientWidth > 0 && w > 0) {
      this.lastFitWidth = box.clientWidth;
      this.scale = Math.max(MIN_SCALE, box.clientWidth / w);
    } else if (scale === "fit-page" && box && box.clientWidth > 0 && box.clientHeight > 0 && w > 0 && h > 0) {
      this.lastFitWidth = box.clientWidth;
      this.lastFitHeight = box.clientHeight;
      this.scale = Math.max(
        MIN_SCALE,
        Math.min(box.clientWidth / w, box.clientHeight / h)
      );
    }
    this.applyTransform();
    this.fireViewport();
  }
  getZoom() {
    return this.scale;
  }
  getViewport() {
    const c = this.container;
    const el = this.displayElement || this.imgElement;
    if (!c || !el || this.naturalW <= 0) return null;
    const cRect = c.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const page = {
      index: this.currentFrame,
      x: eRect.left - cRect.left + c.scrollLeft,
      y: eRect.top - cRect.top + c.scrollTop,
      width: eRect.width,
      height: eRect.height,
      nativeWidth: this.naturalW,
      nativeHeight: this.naturalH
    };
    return {
      scale: this.scale,
      rotation: (this.rotation % 360 + 360) % 360,
      scroll: { x: c.scrollLeft, y: c.scrollTop },
      content: { width: c.scrollWidth, height: c.scrollHeight },
      client: { width: c.clientWidth, height: c.clientHeight },
      devicePixelRatio: typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1,
      unit: "px",
      pages: [page]
    };
  }
  subscribeViewport(callback) {
    this.viewportCbs.add(callback);
    return () => {
      this.viewportCbs.delete(callback);
    };
  }
  goToPage(n) {
    if (this.frames.length <= 1) return;
    this.currentFrame = Math.max(1, Math.min(n, this.frames.length)) - 1;
    this.showFrame(this.currentFrame);
  }
  getRotation() {
    return this.rotation;
  }
  setRotation(degrees) {
    this.rotation = (Math.round(degrees / 90) * 90 % 360 + 360) % 360;
    this.applyTransform();
    this.fireViewport();
  }
  search(_query) {
    const empty = async function* () {
    };
    return empty();
  }
  clearSearch() {
  }
  async getThumbnail(page, maxPx) {
    let source = null;
    let iw = 0;
    let ih = 0;
    if (this.format === "tiff") {
      const idx = Math.max(0, Math.min(page - 1, this.frames.length - 1));
      const frame = this.frames[idx];
      if (frame?.data) {
        const full = document.createElement("canvas");
        full.width = frame.width;
        full.height = frame.height;
        const fctx = full.getContext("2d");
        if (fctx) {
          const rgba = new Uint8ClampedArray(frame.data);
          fctx.putImageData(new ImageData(rgba, frame.width, frame.height), 0, 0);
          source = full;
          iw = frame.width;
          ih = frame.height;
        }
      }
    } else if (this.imgElement) {
      source = this.imgElement;
      iw = this.imgElement.naturalWidth;
      ih = this.imgElement.naturalHeight;
    }
    if (!source || iw === 0 || ih === 0) throw new Error("No image loaded");
    const s = maxPx / Math.max(iw, ih);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(iw * s));
    canvas.height = Math.max(1, Math.round(ih * s));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return createImageBitmap(canvas);
  }
  detectImageFormat(bytes) {
    if (bytes.length < 4) return "native";
    const head = String.fromCharCode(...bytes.slice(0, 500)).trimStart();
    if (head.startsWith("<") && head.toLowerCase().includes("<svg")) return "svg";
    if (bytes[0] === 77 && bytes[1] === 77 && bytes[2] === 0 && bytes[3] === 42) return "tiff";
    if (bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 42 && bytes[3] === 0) return "tiff";
    if (bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112 && (bytes[8] === 104 || bytes[8] === 109)) return "heic";
    return "native";
  }
  async loadNative(data, mount, signal) {
    const container = this.createContainer(mount);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    let img;
    try {
      img = await this.createImage(url, signal);
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    if (signal?.aborted) {
      img.remove();
      URL.revokeObjectURL(url);
      throw new DOMException("Image load cancelled", "AbortError");
    }
    this.imgElement = img;
    this.naturalW = img.naturalWidth;
    this.naturalH = img.naturalHeight;
    container.appendChild(img);
    this.applyTransform();
    return {
      pageCount: 1,
      pages: [{
        index: 0,
        dimensions: { width: img.naturalWidth, height: img.naturalHeight },
        rotation: 0
      }]
    };
  }
  async loadSvg(data, mount, signal) {
    const container = this.createContainer(mount);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    let img;
    try {
      img = await this.createImage(url, signal);
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    if (signal?.aborted) {
      img.remove();
      URL.revokeObjectURL(url);
      throw new DOMException("Image load cancelled", "AbortError");
    }
    this.imgElement = img;
    this.naturalW = img.naturalWidth || 800;
    this.naturalH = img.naturalHeight || 600;
    container.appendChild(img);
    this.applyTransform();
    return {
      pageCount: 1,
      pages: [{
        index: 0,
        dimensions: { width: this.naturalW, height: this.naturalH },
        rotation: 0
      }]
    };
  }
  async loadTiff(data, mount, signal) {
    this.createContainer(mount);
    const worker = new Worker(
      this.tiffWorkerUrl ?? new URL("./workers/tiff.worker.js", import.meta.url),
      { type: "module" }
    );
    this.worker = worker;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        if (this.pendingReject === fail) this.pendingReject = null;
      };
      const succeed = (doc) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(doc);
      };
      const fail = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.worker === worker) {
          worker.terminate();
          this.worker = null;
        }
        reject(err);
      };
      this.pendingReject = fail;
      const onAbort = () => fail(new DOMException("TIFF load cancelled", "AbortError"));
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(
        () => fail(createError("TIMEOUT", "TIFF decode timed out")),
        TIFF_DECODE_TIMEOUT
      );
      worker.onmessage = (e) => {
        const { frames, pages, error } = e.data;
        if (error) {
          fail(createError("DECODE_ERROR", error, { format: "image" }));
          return;
        }
        this.frames = frames;
        this.currentFrame = 0;
        this.renderTiffFrame(0);
        succeed({
          pageCount: pages,
          pages: Array.from({ length: pages }, (_, i) => {
            const f = frames[i];
            return {
              index: i,
              dimensions: {
                width: f?.width ?? 0,
                height: f?.height ?? 0
              },
              rotation: 0
            };
          })
        });
      };
      worker.onerror = (err) => fail(createError("DECODE_ERROR", err.message, { format: "image" }));
      worker.postMessage({ data, type: "decode-tiff" }, [data]);
    });
  }
  async loadHeic(data, mount, signal) {
    const container = this.createContainer(mount);
    const { heicTo } = await import("heic-to/csp");
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      let aborted = false;
      signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Cancelled", "AbortError"));
      }, { once: true });
      const blob = new Blob([data], { type: "image/heic" });
      heicTo({ blob, type: "image/png", quality: 0.9 }).then(async (outBlob) => {
        if (aborted) return;
        if (!outBlob) {
          reject(new Error("HEIC decode produced no output"));
          return;
        }
        const url = URL.createObjectURL(outBlob);
        try {
          this.imgElement = await this.createImage(url, signal);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err instanceof Error ? err : new Error("HEIC decode failed"));
          return;
        }
        if (aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        this.naturalW = this.imgElement.naturalWidth;
        this.naturalH = this.imgElement.naturalHeight;
        container.appendChild(this.imgElement);
        this.displayElement = this.imgElement;
        this.applyTransform();
        resolve({
          pageCount: 1,
          pages: [{ index: 0, dimensions: { width: this.naturalW, height: this.naturalH }, rotation: 0 }]
        });
      }).catch((err) => reject(new Error(err.message || "HEIC decode failed")));
    });
  }
  createContainer(mount) {
    mount.innerHTML = "";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;overflow:auto;display:flex;align-items:safe center;justify-content:safe center;";
    container.addEventListener("scroll", this.fireViewport, { passive: true });
    mount.appendChild(container);
    this.container = container;
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        if (typeof this.zoomMode === "number") return;
        const box = this.container ?? this.mountElement;
        if (!box || box.clientWidth <= 0) return;
        const changed = box.clientWidth !== this.lastFitWidth || this.zoomMode === "fit-page" && box.clientHeight !== this.lastFitHeight;
        if (changed) this.setZoom(this.zoomMode);
      });
      this.resizeObserver.observe(container);
    }
    return container;
  }
  async createImage(src, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Image load cancelled", "AbortError"));
        return;
      }
      const img = document.createElement("img");
      img.style.cssText = "max-width:none;max-height:none;display:block;";
      const onAbort = () => {
        img.src = "";
        reject(new DOMException("Image load cancelled", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      img.onload = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve(img);
      };
      img.onerror = () => {
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Failed to load image"));
      };
      img.src = src;
    });
  }
  applyTransform() {
    const el = this.displayElement || this.imgElement;
    if (!el) return;
    if (this.naturalW > 0 && this.naturalH > 0) {
      el.style.width = `${Math.round(this.naturalW * this.scale)}px`;
      el.style.height = `${Math.round(this.naturalH * this.scale)}px`;
      el.style.flex = "none";
    }
    el.style.transform = `rotate(${this.rotation}deg) scale(${this.flipH ? -1 : 1}, ${this.flipV ? -1 : 1})`;
    el.style.transformOrigin = "center center";
  }
  removeImage() {
    if (this.imgElement) {
      if (this.imgElement.src.startsWith("blob:")) {
        URL.revokeObjectURL(this.imgElement.src);
      }
      this.imgElement.remove();
      this.imgElement = null;
    }
    if (this.displayElement) {
      this.displayElement.remove();
      this.displayElement = null;
    }
  }
  showFrame(index) {
    const frame = this.frames[index];
    if (!frame) return;
    if (this.format === "tiff") {
      this.renderTiffFrame(index);
      this.fireViewport();
      return;
    }
    if (this.imgElement && frame.data instanceof Blob) {
      const prev = this.imgElement.src;
      this.imgElement.src = URL.createObjectURL(frame.data);
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    }
    this.fireViewport();
  }
  /** Render a decoded TIFF frame (raw RGBA) into the display canvas, reusing it. */
  renderTiffFrame(index) {
    const frame = this.frames[index];
    if (!frame?.data) return;
    const canvas = this.displayElement instanceof HTMLCanvasElement ? this.displayElement : document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rgba = new Uint8ClampedArray(frame.data);
    ctx.putImageData(new ImageData(rgba, frame.width, frame.height), 0, 0);
    this.naturalW = frame.width;
    this.naturalH = frame.height;
    if (this.displayElement !== canvas) {
      canvas.style.cssText = "display:block;";
      this.container?.appendChild(canvas);
      this.displayElement = canvas;
    }
    this.applyTransform();
  }
  async toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) return data;
    return data.arrayBuffer();
  }
};
function createImageAdapterFactory(options = {}) {
  return {
    format: "image",
    capabilities: IMAGE_CAPABILITIES,
    create: () => new ImageAdapter(options)
  };
}
export {
  ImageAdapter,
  createImageAdapterFactory
};
//# sourceMappingURL=index.js.map