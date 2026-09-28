import type { ViewportMetrics } from "../adapters/DocumentAdapter.js";

/**
 * The page (0-based index) the user would say they are "on": the page whose
 * rect has the greatest visible area — the largest intersection with the
 * viewport (derived from `scroll` + `client`). Ties resolve to the lower
 * index. If no page intersects the viewport at all (e.g. the viewport sits
 * inside a margin gap), the page whose centre is nearest the viewport centre
 * wins. Returns `null` when `pages` is empty (layout not reported yet).
 *
 * Pure geometry over {@link ViewportMetrics} — no adapter or DOM access — so
 * it works for any adapter that reports true per-page rects.
 */
export function computeVisiblePage(metrics: ViewportMetrics): number | null {
  const { pages, scroll, client } = metrics;
  if (pages.length === 0) return null;

  const viewLeft = scroll.x;
  const viewTop = scroll.y;
  const viewRight = scroll.x + client.width;
  const viewBottom = scroll.y + client.height;

  let best: number | null = null;
  let bestArea = 0;
  for (const page of pages) {
    const w =
      Math.min(page.x + page.width, viewRight) - Math.max(page.x, viewLeft);
    const h =
      Math.min(page.y + page.height, viewBottom) - Math.max(page.y, viewTop);
    if (w <= 0 || h <= 0) continue;
    const area = w * h;
    // Strict > plus the index check keeps ties on the lower page index even if
    // the rects arrive out of index order (e.g. from a virtualized layout).
    if (
      area > bestArea ||
      (area === bestArea && best !== null && page.index < best)
    ) {
      best = page.index;
      bestArea = area;
    }
  }
  if (best !== null) return best;

  // Nothing intersects: fall back to the page whose centre is nearest the
  // viewport centre, so the indicator stays sensible inside margin gaps.
  const cx = viewLeft + client.width / 2;
  const cy = viewTop + client.height / 2;
  let nearest: number | null = null;
  let nearestDist = Infinity;
  for (const page of pages) {
    const dx = page.x + page.width / 2 - cx;
    const dy = page.y + page.height / 2 - cy;
    const dist = dx * dx + dy * dy;
    if (
      dist < nearestDist ||
      (dist === nearestDist && nearest !== null && page.index < nearest)
    ) {
      nearest = page.index;
      nearestDist = dist;
    }
  }
  return nearest;
}
