import type {
  DocumentRect,
  ViewportMetrics,
} from "../adapters/DocumentAdapter.js";

/** An axis-aligned rectangle in the viewer's client (viewport) pixel space.
 * (Named to avoid shadowing the deprecated DOM `ClientRect` global.) */
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Project a rectangle given in a page's native, un-rotated document units
 * (top-left origin — PDF points / image pixels) to its current on-screen
 * position in the viewer's client space, accounting for scale, scroll, and
 * rotation. Returns `null` if the page isn't laid out yet.
 *
 * This is the anchoring primitive for chrome that must track a document region
 * — highlights/marks, guides, measurement, comment pins — across zoom, pan and
 * rotation, without the embedder reimplementing the per-adapter geometry.
 */
export function projectRect(
  metrics: ViewportMetrics,
  pageIndex: number,
  rect: DocumentRect,
): ViewportRect | null {
  // Match strictly on the page's declared index — a positional fallback could
  // silently project onto the wrong page when the list is virtualized.
  const page = metrics.pages.find((p) => p.index === pageIndex);
  if (!page) return null;

  const rot = ((metrics.rotation % 360) + 360) % 360;
  const s = metrics.scale;
  const Wn = page.nativeWidth;
  const Hn = page.nativeHeight;
  const { x, y, width, height } = rect;

  // Rotate the native rect into the page's rotated-local top-left frame
  // (still in native units), then scale + offset into client space.
  let rlx: number;
  let rly: number;
  let rw: number;
  let rh: number;
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
    height: rh * s,
  };
}

/** Smallest rect containing all of `rects`, or `null` for an empty list.
 * Same coordinate space in, same space out. */
export function unionRects(rects: DocumentRect[]): DocumentRect | null {
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

/** Padding from the viewport edge when aligning a rect to 'start'. */
const START_ALIGN_PADDING = 16;

/**
 * Compute the absolute scroll offset that brings `rect` (native, un-rotated
 * document units, top-left origin) on page `pageIndex` into view. Builds on
 * {@link projectRect}, so scale, scroll and rotation are all accounted for —
 * the result is scroll-invariant (adding the current scroll back to the
 * projected client position yields a content coordinate), which keeps it
 * correct even while a previous smooth scroll is still in flight. Returns
 * `null` if the page isn't laid out yet.
 */
export function computeScrollTarget(
  metrics: ViewportMetrics,
  pageIndex: number,
  rect: DocumentRect,
  align: "center" | "start" = "center",
): { left: number; top: number } | null {
  const p = projectRect(metrics, pageIndex, rect);
  if (!p) return null;

  // Content-space position of the projected rect.
  const cx = p.x + metrics.scroll.x;
  const cy = p.y + metrics.scroll.y;

  let left: number;
  let top: number;
  if (align === "start") {
    left = cx - START_ALIGN_PADDING;
    top = cy - START_ALIGN_PADDING;
  } else {
    left = cx - (metrics.client.width - p.width) / 2;
    top = cy - (metrics.client.height - p.height) / 2;
  }

  // Clamp into the scrollable range; the lower bound wins when the content is
  // smaller than the viewport.
  const maxLeft = Math.max(0, metrics.content.width - metrics.client.width);
  const maxTop = Math.max(0, metrics.content.height - metrics.client.height);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}
