export interface DocumentSource {
  data: ArrayBuffer | Blob;
  mimeType?: string;
  fileName?: string;
}

export interface Size {
  width: number;
  height: number;
}

export interface PageInfo {
  index: number;
  dimensions: Size;
  rotation: number;
}

export type ZoomMode = number | "fit-width" | "fit-page";

/** Geometry of one laid-out page within the scroll content, in CSS pixels at
 * the current scale. `x`/`y` are offsets from the content's top-left origin and
 * `width`/`height` are the on-screen (post-rotation) box. `nativeWidth`/
 * `nativeHeight` are the page's un-rotated size in its native document units
 * (PDF points / image pixels) — the space bounding boxes are expressed in. */
export interface PageRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nativeWidth: number;
  nativeHeight: number;
}

/** An axis-aligned rectangle in a page's native, un-rotated document units
 * (top-left origin): PDF points or image pixels. */
export interface DocumentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A snapshot of how document content is currently laid out in the viewport.
 * All measurements are CSS pixels. This is the data an embedder needs to draw
 * chrome that must track the content — rulers, guides, measurement tools,
 * minimaps, comment pins — without knowing the adapter's internal layout.
 *
 * Screen X of a content coordinate `cx` is `cx - scroll.x` (plus the ruler's
 * own origin); the value in document units is `cx / scale` (see `unit`).
 */
export interface ViewportMetrics {
  /** Resolved numeric zoom (1 = 100%). */
  scale: number;
  /** Display rotation in degrees (normalized 0/90/180/270). Page rects already
   * reflect it (width/height swap at 90/270); it's exposed so overlays anchored
   * to the document (e.g. guides) can rotate with the content. */
  rotation: number;
  /** Scroll offset of the content within the viewport. */
  scroll: { x: number; y: number };
  /** Total scrollable content size. */
  content: Size;
  /** Visible viewport size (excludes scrollbars). */
  client: Size;
  /** Backing-store ratio, for crisp tick rendering on HiDPI displays. */
  devicePixelRatio: number;
  /** Native unit of one content pixel at `scale === 1`: PDF points, or image pixels. */
  unit: "pt" | "px";
  /** Per-page rectangles in content coordinates (may be empty before layout). */
  pages: PageRect[];
}

/** One text match. `bounds` are in the page's native, un-rotated document
 * units with a **top-left origin** (the space {@link projectRect} consumes),
 * for both `search()` and `findMatches()`. Matches are non-overlapping and
 * yielded in reading order (page-ascending); a match's position in `search()`'s
 * yield order is the index `setActiveSearchMatch` receives. An empty `bounds`
 * means the adapter cannot report geometry (e.g. DOCX searches inside its
 * iframe) — consumers must not navigate from such a match. */
export interface SearchMatch {
  pageIndex: number;
  text: string;
  bounds: { x: number; y: number; width: number; height: number }[];
}

/** Options for {@link DocumentAdapter.scrollToRect}. */
export interface ScrollToRectOptions {
  /** Scroll animation. Default 'smooth'. */
  behavior?: ScrollBehavior;
  /** Where the rect lands in the viewport. Default 'center'. */
  align?: "center" | "start";
}

export interface LoadOptions {
  signal?: AbortSignal;
  initialPage?: number;
  initialZoom?: ZoomMode;
  password?: string;
}

export interface LoadedDocument {
  pageCount: number;
  pages: PageInfo[];
  version?: string;
  metadata?: Record<string, string>;
}

export interface AdapterCapabilities {
  pageCount: boolean;
  textSearch: boolean;
  textSelection: boolean;
  thumbnails: boolean;
  rotation: boolean;
  /** Toggling optional content groups / layers (PDF OCGs). */
  layers: boolean;
  /** Showing/hiding the annotation layer (PDF /Annots: links, markup, etc.). */
  annotations: boolean;
  /** Exposing live viewport metrics (scale/scroll/page geometry) for chrome
   * that tracks content, e.g. rulers and guides. */
  viewport: boolean;
  /** Precise scrolling to a DocumentRect on a page (`scrollToRect`). */
  scrollToRect: boolean;
}

/**
 * A toggleable content layer. For PDF these are Optional Content Groups (OCGs);
 * `id` is the group identifier used to toggle visibility.
 */
export interface DocumentLayer {
  id: string;
  name: string;
  visible: boolean;
}

/**
 * Metadata for a single annotation, for inspection (e.g. forensic review).
 * Fields other than the first four are only present when the source provides
 * them. Dates are the raw values from the document (not reformatted).
 */
export interface DocumentAnnotation {
  id: string;
  pageIndex: number;
  subtype: string;
  rect: [number, number, number, number];
  contents?: string;
  author?: string;
  created?: string;
  modified?: string;
  color?: string;
  url?: string;
  fieldName?: string;
  fieldValue?: string;
  /** Id of the optional content group this annotation belongs to, if any. */
  layerId?: string;
}

export interface DocumentAdapter {
  load(
    source: DocumentSource,
    mount: HTMLElement,
    opts: LoadOptions,
  ): Promise<LoadedDocument>;

  destroy(): void;

  readonly capabilities: AdapterCapabilities;

  goToPage?(n: number): void;
  setZoom(scale: ZoomMode): void;
  /** The current resolved zoom as a numeric scale factor (1 = 100%). */
  getZoom?(): number;
  search?(query: string): AsyncIterable<SearchMatch>;
  clearSearch?(): void;
  /** Scroll the viewport so `rect` (native, un-rotated document units,
   * top-left origin — the {@link projectRect} space) on page `pageIndex` is
   * visible. Resolves once the scroll has been issued against settled page
   * layout. */
  scrollToRect?(
    pageIndex: number,
    rect: DocumentRect,
    opts?: ScrollToRectOptions,
  ): Promise<void>;
  /** Mark which match of the CURRENT interactive search is active, by its
   * position in `search()`'s yield order, or `null` for none. Drives distinct
   * styling of the active highlight. An adapter whose activation has engine
   * side effects that move the viewport (DOCX walks the engine's find cursor,
   * which scrolls on its own) must return a promise resolving once those
   * effects have settled, so the store can issue its precise scroll after
   * them; a synchronous activation returns nothing. Implementations should
   * resolve rather than reject — the store treats a rejection as settled and
   * scrolls anyway. */
  setActiveSearchMatch?(index: number | null): void | Promise<void>;
  /** One-shot text location: return every match for `query` WITHOUT changing
   * interactive search state or drawing highlights. Powers overlays (marks)
   * that need a text region's geometry. Text-capable formats only.
   *
   * `bounds` are in the page's native, un-rotated document units with a
   * **top-left origin** (the space {@link projectRect} consumes) — PDF flips
   * from its native bottom-left; DOCX reports un-zoomed CSS pixels. */
  findMatches?(query: string): Promise<SearchMatch[]>;
  getThumbnail?(page: number, maxPx: number): Promise<ImageBitmap>;

  /** Optional content layers for the loaded document (empty if none). */
  getLayers?(): DocumentLayer[];
  /** Show/hide a layer by id and re-render affected pages. */
  setLayerVisibility?(id: string, visible: boolean): void;

  /** Whether the annotation layer is currently shown. */
  getAnnotationsVisible?(): boolean;
  /** Show/hide the annotation layer and re-render affected pages. */
  setAnnotationsVisible?(visible: boolean): void;
  /** All annotations in the document with metadata, for inspection. */
  getAnnotations?(): Promise<DocumentAnnotation[]>;

  /** Current display rotation in degrees (normalized to 0/90/180/270). */
  getRotation?(): number;
  /** Set the display rotation (degrees) and re-render affected pages. */
  setRotation?(degrees: number): void;

  /** Current viewport metrics, or `null` before content is laid out. */
  getViewport?(): ViewportMetrics | null;
  /** Subscribe to viewport changes (scroll / zoom / resize / relayout).
   * Returns an unsubscribe function. */
  subscribeViewport?(callback: () => void): () => void;
}

export interface AdapterFactory {
  readonly format: DocumentFormat;
  readonly capabilities: AdapterCapabilities;
  create(): DocumentAdapter;
}

export type DocumentFormat = "pdf" | "docx" | "image";
