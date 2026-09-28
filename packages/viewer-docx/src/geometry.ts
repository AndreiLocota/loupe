import type {
  PageRect,
  Size,
  ViewportMetrics,
} from "@veridox-ai/loupe-core";

/** ECMA-376 page sizes are points; the viewer lays out in CSS px at 96 dpi. */
export const PT_TO_PX = 96 / 72;

/** Layout options we pass to DocxScrollViewer, mirrored here so page-rect
 * synthesis stays in lockstep with the viewer's real layout. */
export const VIEWER_LAYOUT = {
  gap: 16,
  paddingTop: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  paddingRight: 16,
} as const;

/**
 * Locate the element the scroll viewer actually scrolls. The viewer creates
 * its own scroll host inside the container we hand it and exposes no public
 * handle, so probe computed styles; fall back to the container itself.
 */
export function findScrollHost(container: HTMLElement): HTMLElement {
  const candidates: HTMLElement[] = [
    container,
    ...Array.from(container.querySelectorAll<HTMLElement>("div")),
  ];
  for (const el of candidates) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return container;
}

/**
 * One rect per document page (all pages, not just mounted ones — virtualised
 * pages have no DOM, and the store's page tracking only engages when
 * pages.length equals the document's pageCount). Vertical stacking follows the
 * viewer's layout: top padding, then each page's scaled height plus the
 * inter-page gap; horizontally each page is centred in the content width.
 */
export function computePageRects(
  nativeSizes: readonly Size[],
  scale: number,
  contentWidth: number,
): PageRect[] {
  const rects: PageRect[] = [];
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
      nativeHeight: native.height,
    });
    y += height + VIEWER_LAYOUT.gap;
  }
  return rects;
}

/** Snapshot the live viewport in CSS px (`unit: "px"`, rotation always 0 —
 * DOCX pages don't rotate). */
export function computeViewportMetrics(
  scroller: HTMLElement,
  nativeSizes: readonly Size[],
  scale: number,
): ViewportMetrics {
  const content = {
    width: scroller.scrollWidth,
    height: scroller.scrollHeight,
  };
  return {
    scale,
    rotation: 0,
    scroll: { x: scroller.scrollLeft, y: scroller.scrollTop },
    content,
    client: { width: scroller.clientWidth, height: scroller.clientHeight },
    devicePixelRatio: globalThis.devicePixelRatio ?? 1,
    unit: "px",
    pages: computePageRects(nativeSizes, scale, content.width),
  };
}
