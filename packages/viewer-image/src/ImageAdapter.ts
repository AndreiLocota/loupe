import { createError } from '@veridox-ai/loupe-core';
import type {
  DocumentAdapter,
  AdapterFactory,
  AdapterCapabilities,
  DocumentSource,
  LoadOptions,
  LoadedDocument,
  PageRect,
  SearchMatch,
  ViewportMetrics,
  ZoomMode,
} from '@veridox-ai/loupe-core';

const TIFF_DECODE_TIMEOUT = 30000;

const IMAGE_CAPABILITIES: AdapterCapabilities = {
  pageCount: false,
  textSearch: false,
  textSelection: false,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: false,
};

const TIFF_CAPABILITIES: AdapterCapabilities = {
  pageCount: true,
  textSearch: false,
  textSelection: false,
  thumbnails: true,
  rotation: true,
  layers: false,
  annotations: false,
  viewport: true,
  scrollToRect: false,
};

export interface ImageAdapterOptions {
  /**
   * URL of the bundled multi-page TIFF decode worker. Provide this when the
   * asset can't be resolved relative to the module (e.g. when the library is
   * consumed as a pre-built bundle). Falls back to `import.meta.url` resolution.
   */
  tiffWorkerUrl?: string;
}

type ImageFormat = 'native' | 'svg' | 'tiff' | 'heic';

interface DecodedFrame {
  data: ImageBitmap | Blob;
  width: number;
  height: number;
  delay?: number;
}

// Floor for the render scale so a not-yet-laid-out container (clientWidth 0)
// can never produce a 0x0 image (same protection as the PDF adapter).
const MIN_SCALE = 0.1;

export class ImageAdapter implements DocumentAdapter {
  private mountElement: HTMLElement | null = null;
  private container: HTMLDivElement | null = null;
  private imgElement: HTMLImageElement | null = null;
  private displayElement: HTMLElement | null = null;
  private format: ImageFormat = 'native';
  private frames: DecodedFrame[] = [];
  private currentFrame = 0;
  private _capabilities = IMAGE_CAPABILITIES;
  private scale = 1;
  // The requested zoom (mode or number), so fit modes can be re-applied when
  // the container is resized or becomes visible.
  private zoomMode: ZoomMode = 1;
  private resizeObserver: ResizeObserver | null = null;
  private lastFitWidth = 0;
  private lastFitHeight = 0;
  private rotation = 0;
  private flipH = false;
  private flipV = false;
  private naturalW = 0;
  private naturalH = 0;
  private worker: Worker | null = null;
  private tiffWorkerUrl: string | undefined;
  private viewportCbs = new Set<() => void>();

  private fireViewport = (): void => {
    for (const cb of this.viewportCbs) cb();
  };
  // Reject handle for an in-flight load so destroy()/abort can settle a promise
  // that would otherwise hang (e.g. a TIFF decode whose worker is terminated).
  private pendingReject: ((err: Error) => void) | null = null;

  constructor(options: ImageAdapterOptions = {}) {
    this.tiffWorkerUrl = options.tiffWorkerUrl;
  }

  get capabilities(): AdapterCapabilities {
    return this._capabilities;
  }

  async load(
    source: DocumentSource,
    mount: HTMLElement,
    opts: LoadOptions,
  ): Promise<LoadedDocument> {
    this.mountElement = mount;
    const signal = opts.signal;
    if (signal?.aborted) throw new DOMException('Image load cancelled', 'AbortError');

    const data = await this.toArrayBuffer(source.data);
    if (signal?.aborted) throw new DOMException('Image load cancelled', 'AbortError');
    this.format = this.detectImageFormat(new Uint8Array(data));

    if (this.format === 'svg') {
      return this.loadSvg(data, mount, signal);
    }
    if (this.format === 'tiff') {
      this._capabilities = TIFF_CAPABILITIES;
      return this.loadTiff(data, mount, signal);
    }
    if (this.format === 'heic') {
      return this.loadHeic(data, mount, signal);
    }

    return this.loadNative(data, mount, signal);
  }

  destroy(): void {
    // Settle any in-flight load first so a caller awaiting load() doesn't hang
    // (worker.terminate() fires neither onmessage nor onerror).
    if (this.pendingReject) {
      this.pendingReject(createError('WORKER_TERMINATED', 'Image load cancelled'));
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

  setZoom(scale: ZoomMode): void {
    this.zoomMode = scale;
    const box = this.container ?? this.mountElement;
    // On-screen footprint accounts for 90/270° rotation (w/h swapped).
    const rotated = this.rotation % 180 !== 0;
    const w = rotated ? this.naturalH : this.naturalW;
    const h = rotated ? this.naturalW : this.naturalH;
    if (typeof scale === 'number') {
      this.scale = scale;
    } else if (scale === 'fit-width' && box && box.clientWidth > 0 && w > 0) {
      // Guard + clamp: a hidden or not-yet-laid-out container (clientWidth 0)
      // must not produce scale 0 (an invisible 0x0 image). The ResizeObserver
      // re-fits once the container has a real size.
      this.lastFitWidth = box.clientWidth;
      this.scale = Math.max(MIN_SCALE, box.clientWidth / w);
    } else if (
      scale === 'fit-page' &&
      box &&
      box.clientWidth > 0 &&
      box.clientHeight > 0 &&
      w > 0 &&
      h > 0
    ) {
      this.lastFitWidth = box.clientWidth;
      this.lastFitHeight = box.clientHeight;
      this.scale = Math.max(
        MIN_SCALE,
        Math.min(box.clientWidth / w, box.clientHeight / h),
      );
    }
    this.applyTransform();
    this.fireViewport();
  }

  getZoom(): number {
    return this.scale;
  }

  getViewport(): ViewportMetrics | null {
    const c = this.container;
    const el = this.displayElement || this.imgElement;
    if (!c || !el || this.naturalW <= 0) return null;
    const cRect = c.getBoundingClientRect();
    const eRect = el.getBoundingClientRect(); // post-transform: rotated bounding box
    const page: PageRect = {
      index: this.currentFrame,
      x: eRect.left - cRect.left + c.scrollLeft,
      y: eRect.top - cRect.top + c.scrollTop,
      width: eRect.width,
      height: eRect.height,
      nativeWidth: this.naturalW,
      nativeHeight: this.naturalH,
    };
    return {
      scale: this.scale,
      rotation: ((this.rotation % 360) + 360) % 360,
      scroll: { x: c.scrollLeft, y: c.scrollTop },
      content: { width: c.scrollWidth, height: c.scrollHeight },
      client: { width: c.clientWidth, height: c.clientHeight },
      devicePixelRatio:
        typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
      unit: 'px',
      pages: [page],
    };
  }

  subscribeViewport(callback: () => void): () => void {
    this.viewportCbs.add(callback);
    return () => {
      this.viewportCbs.delete(callback);
    };
  }

  goToPage?(n: number): void {
    if (this.frames.length <= 1) return;
    this.currentFrame = Math.max(1, Math.min(n, this.frames.length)) - 1;
    this.showFrame(this.currentFrame);
  }

  getRotation(): number {
    return this.rotation;
  }

  setRotation(degrees: number): void {
    this.rotation = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
    this.applyTransform();
    this.fireViewport();
  }

  search?(_query: string): AsyncIterable<SearchMatch> {
    const empty = async function* (): AsyncIterable<SearchMatch> {};
    return empty();
  }

  clearSearch?(): void {}

  async getThumbnail?(page: number, maxPx: number): Promise<ImageBitmap> {
    // Source is an <img> (native/svg/heic) or, for TIFF, a raw RGBA frame drawn
    // into an offscreen canvas so we don't disturb the currently displayed page.
    let source: HTMLImageElement | HTMLCanvasElement | null = null;
    let iw = 0;
    let ih = 0;

    if (this.format === 'tiff') {
      // `page` is 1-based (matching goToPage); convert to a 0-based frame index.
      const idx = Math.max(0, Math.min(page - 1, this.frames.length - 1));
      const frame = this.frames[idx];
      if (frame?.data) {
        const full = document.createElement('canvas');
        full.width = frame.width;
        full.height = frame.height;
        const fctx = full.getContext('2d');
        if (fctx) {
          const rgba = new Uint8ClampedArray(frame.data as unknown as ArrayBuffer);
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

    if (!source || iw === 0 || ih === 0) throw new Error('No image loaded');

    const s = maxPx / Math.max(iw, ih);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(iw * s));
    canvas.height = Math.max(1, Math.round(ih * s));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return createImageBitmap(canvas);
  }

  private detectImageFormat(bytes: Uint8Array): ImageFormat {
    if (bytes.length < 4) return 'native';
    const head = String.fromCharCode(...bytes.slice(0, 500)).trimStart();
    // Markup rooted at <svg>, allowing a leading XML prolog / DOCTYPE / comment.
    if (head.startsWith('<') && head.toLowerCase().includes('<svg')) return 'svg';
    // TIFF requires the version-42 magic (bytes 2-3), not just the "II"/"MM"
    // byte-order mark, so ASCII text starting with those letters isn't misread.
    if (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A) return 'tiff';
    if (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) return 'tiff';
    if (
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 &&
      bytes[7] === 0x70 && (bytes[8] === 0x68 || bytes[8] === 0x6D)
    ) return 'heic';
    return 'native';
  }

  private async loadNative(data: ArrayBuffer, mount: HTMLElement, signal?: AbortSignal): Promise<LoadedDocument> {
    const container = this.createContainer(mount);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    // On any failure/abort the <img> never becomes this.imgElement, so removeImage
    // won't revoke it — revoke here to avoid leaking the object URL. On success the
    // URL stays live (the <img> references it) and removeImage revokes it later.
    let img: HTMLImageElement;
    try {
      img = await this.createImage(url, signal);
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    if (signal?.aborted) {
      img.remove();
      URL.revokeObjectURL(url);
      throw new DOMException('Image load cancelled', 'AbortError');
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
        rotation: 0,
      }],
    };
  }

  private async loadSvg(data: ArrayBuffer, mount: HTMLElement, signal?: AbortSignal): Promise<LoadedDocument> {
    const container = this.createContainer(mount);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    let img: HTMLImageElement;
    try {
      img = await this.createImage(url, signal);
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    if (signal?.aborted) {
      img.remove();
      URL.revokeObjectURL(url);
      throw new DOMException('Image load cancelled', 'AbortError');
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
        rotation: 0,
      }],
    };
  }

  private async loadTiff(data: ArrayBuffer, mount: HTMLElement, signal?: AbortSignal): Promise<LoadedDocument> {
    this.createContainer(mount);
    const worker = new Worker(
      this.tiffWorkerUrl ?? new URL('./workers/tiff.worker.js', import.meta.url),
      { type: 'module' },
    );
    this.worker = worker;

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        if (this.pendingReject === fail) this.pendingReject = null;
      };
      const succeed = (doc: LoadedDocument): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(doc);
      };
      const fail = (err: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        // Terminate the decode worker on any failure so it doesn't keep running.
        if (this.worker === worker) { worker.terminate(); this.worker = null; }
        reject(err);
      };

      // destroy()/abort can settle this promise; without it a terminated worker
      // fires neither onmessage nor onerror and load() hangs forever.
      this.pendingReject = fail;
      const onAbort = (): void => fail(new DOMException('TIFF load cancelled', 'AbortError'));
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener('abort', onAbort, { once: true });

      // No engine-side cancel hook, so bound the decode with a timeout.
      const timeout = setTimeout(
        () => fail(createError('TIMEOUT', 'TIFF decode timed out')),
        TIFF_DECODE_TIMEOUT,
      );

      worker.onmessage = (e): void => {
        const { frames, pages, error } = e.data;
        if (error) { fail(createError('DECODE_ERROR', error, { format: 'image' })); return; }

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
                height: f?.height ?? 0,
              },
              rotation: 0,
            };
          }),
        });
      };

      worker.onerror = (err): void => fail(createError('DECODE_ERROR', err.message, { format: 'image' }));
      worker.postMessage({ data, type: 'decode-tiff' }, [data]);
    });
  }

  private async loadHeic(
    data: ArrayBuffer,
    mount: HTMLElement,
    signal?: AbortSignal,
  ): Promise<LoadedDocument> {
    const container = this.createContainer(mount);

    // heic-to's CSP build decodes with WASM libheif inside its own worker and
    // does NOT use `new Function`, so HEIC stays within the library's documented
    // CSP (`script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:`) — no
    // `'unsafe-eval'` required.
    const { heicTo } = await import('heic-to/csp');

    return new Promise((resolve, reject) => {
      // Honor an already-aborted signal before kicking off the decode.
      if (signal?.aborted) {
        reject(new DOMException('Cancelled', 'AbortError'));
        return;
      }
      let aborted = false;
      signal?.addEventListener('abort', () => {
        aborted = true;
        // heic-to exposes no cancel hook: the decode runs to completion inside
        // its worker (off the main thread) and its result is discarded here.
        reject(new DOMException('Cancelled', 'AbortError'));
      }, { once: true });

      const blob = new Blob([data], { type: 'image/heic' });

      heicTo({ blob, type: 'image/png', quality: 0.9 })
        .then(async (outBlob) => {
          if (aborted) return;
          if (!outBlob) { reject(new Error('HEIC decode produced no output')); return; }

          const url = URL.createObjectURL(outBlob);
          try {
            this.imgElement = await this.createImage(url, signal);
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err instanceof Error ? err : new Error('HEIC decode failed'));
            return;
          }
          if (aborted) { URL.revokeObjectURL(url); return; }

          // The decoded PNG's <img> reports the true pixel dimensions, so we read
          // them off the element rather than paying for a second decode.
          this.naturalW = this.imgElement.naturalWidth;
          this.naturalH = this.imgElement.naturalHeight;
          container.appendChild(this.imgElement);
          this.displayElement = this.imgElement;
          this.applyTransform();

          resolve({
            pageCount: 1,
            pages: [{ index: 0, dimensions: { width: this.naturalW, height: this.naturalH }, rotation: 0 }],
          });
        })
        .catch((err) => reject(new Error((err as Error).message || 'HEIC decode failed')));
    });
  }

  private createContainer(mount: HTMLElement): HTMLDivElement {
    mount.innerHTML = '';
    const container = document.createElement('div');
    // Scrollable viewport: `safe center` centers content that fits and falls
    // back to start-alignment (scrollable, not clipped) once it's larger than
    // the viewport — so a zoomed image can be panned via scrollbars like PDFs.
    container.style.cssText =
      'width:100%;height:100%;overflow:auto;display:flex;' +
      'align-items:safe center;justify-content:safe center;';
    container.addEventListener('scroll', this.fireViewport, { passive: true });
    mount.appendChild(container);
    this.container = container;

    // Re-apply the active fit mode when the container is (re)sized. This also
    // corrects loads into a hidden container (e.g. an unselected tab): the
    // first callback after it becomes visible fires with the settled size and
    // re-fits. Mirrors the PDF adapter.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        if (typeof this.zoomMode === 'number') return;
        const box = this.container ?? this.mountElement;
        if (!box || box.clientWidth <= 0) return;
        const changed =
          box.clientWidth !== this.lastFitWidth ||
          (this.zoomMode === 'fit-page' &&
            box.clientHeight !== this.lastFitHeight);
        if (changed) this.setZoom(this.zoomMode);
      });
      this.resizeObserver.observe(container);
    }
    return container;
  }

  private async createImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Image load cancelled', 'AbortError'));
        return;
      }
      const img = document.createElement('img');
      img.style.cssText = 'max-width:none;max-height:none;display:block;';
      const onAbort = (): void => {
        img.src = '';
        reject(new DOMException('Image load cancelled', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      img.onload = (): void => { signal?.removeEventListener('abort', onAbort); resolve(img); };
      img.onerror = (): void => { signal?.removeEventListener('abort', onAbort); reject(new Error('Failed to load image')); };
      img.src = src;
    });
  }

  private applyTransform(): void {
    const el = this.displayElement || this.imgElement;
    if (!el) return;
    // Size the element by the zoom (so the scroll container can pan the zoomed
    // content); rotation/flip stay as a transform. `flex:none` stops the flex
    // viewport from shrinking it back to fit.
    if (this.naturalW > 0 && this.naturalH > 0) {
      el.style.width = `${Math.round(this.naturalW * this.scale)}px`;
      el.style.height = `${Math.round(this.naturalH * this.scale)}px`;
      el.style.flex = 'none';
    }
    el.style.transform =
      `rotate(${this.rotation}deg) scale(${this.flipH ? -1 : 1}, ${this.flipV ? -1 : 1})`;
    el.style.transformOrigin = 'center center';
  }

  private removeImage(): void {
    if (this.imgElement) {
      if (this.imgElement.src.startsWith('blob:')) {
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

  private showFrame(index: number): void {
    const frame = this.frames[index];
    if (!frame) return;

    // TIFF frames arrive as raw RGBA buffers rendered into a reusable canvas.
    if (this.format === 'tiff') {
      this.renderTiffFrame(index);
      this.fireViewport();
      return;
    }

    // Other multi-frame sources swap the <img> source.
    if (this.imgElement && frame.data instanceof Blob) {
      const prev = this.imgElement.src;
      this.imgElement.src = URL.createObjectURL(frame.data);
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    }
    this.fireViewport();
  }

  /** Render a decoded TIFF frame (raw RGBA) into the display canvas, reusing it. */
  private renderTiffFrame(index: number): void {
    const frame = this.frames[index];
    if (!frame?.data) return;

    const canvas = this.displayElement instanceof HTMLCanvasElement
      ? this.displayElement
      : document.createElement('canvas');

    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgba = new Uint8ClampedArray(frame.data as unknown as ArrayBuffer);
    ctx.putImageData(new ImageData(rgba, frame.width, frame.height), 0, 0);

    this.naturalW = frame.width;
    this.naturalH = frame.height;

    if (this.displayElement !== canvas) {
      // No max-width/height cap: the element is sized explicitly by zoom so the
      // scroll container can pan it.
      canvas.style.cssText = 'display:block;';
      this.container?.appendChild(canvas);
      this.displayElement = canvas;
    }
    this.applyTransform();
  }

  private async toArrayBuffer(data: ArrayBuffer | Blob): Promise<ArrayBuffer> {
    if (data instanceof ArrayBuffer) return data;
    return data.arrayBuffer();
  }
}

export function createImageAdapterFactory(options: ImageAdapterOptions = {}): AdapterFactory {
  return {
    format: 'image',
    capabilities: IMAGE_CAPABILITIES,
    create: () => new ImageAdapter(options),
  };
}
