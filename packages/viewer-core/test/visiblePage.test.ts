import { describe, expect, it } from "vitest";
import type {
  PageRect,
  ViewportMetrics,
} from "../src/adapters/DocumentAdapter.js";
import { computeVisiblePage } from "../src/viewport/visiblePage.js";

/** Vertical page stack: `heights` pages of width 800, `gap` px between them. */
function stackedPages(heights: number[], gap = 10): PageRect[] {
  let y = gap;
  return heights.map((height, index) => {
    const rect: PageRect = {
      index,
      x: 0,
      y,
      width: 800,
      height,
      nativeWidth: 800,
      nativeHeight: height,
    };
    y += height + gap;
    return rect;
  });
}

function metricsFor(
  pages: PageRect[],
  scrollY: number,
  clientHeight: number,
  scrollX = 0,
  clientWidth = 800,
): ViewportMetrics {
  const bottom = pages.at(-1);
  return {
    scale: 1,
    rotation: 0,
    scroll: { x: scrollX, y: scrollY },
    content: { width: 800, height: bottom ? bottom.y + bottom.height + 10 : 0 },
    client: { width: clientWidth, height: clientHeight },
    devicePixelRatio: 1,
    unit: "pt",
    pages,
  };
}

describe("computeVisiblePage", () => {
  it("picks the dominant page mid-document (6-page repro shape)", () => {
    // Six 1000px pages, viewport 800px, scrolled deep into page 5 (index 4):
    // the shape of the VDX-188 repro, where the indicator stuck on page 1.
    const pages = stackedPages([1000, 1000, 1000, 1000, 1000, 1000]);
    const page5 = pages[4]!;
    // 700px of page 5 visible, 90px of page 4 above it.
    const m = metricsFor(pages, page5.y - 100, 800);
    expect(computeVisiblePage(m)).toBe(4);
  });

  it("resolves an exact 50/50 tie to the lower index", () => {
    const pages = stackedPages([500, 500], 0); // no gap: contiguous pages
    // Viewport of 500 straddling the boundary: 250px of each page visible.
    const m = metricsFor(pages, 250, 500);
    expect(computeVisiblePage(m)).toBe(0);
  });

  it("picks the single dominant page when zoomed past the viewport", () => {
    // Zoomed: one page is far larger than the viewport and fills it entirely.
    const pages = stackedPages([3000, 3000, 3000]);
    const page2 = pages[1]!;
    const m = metricsFor(pages, page2.y + 1000, 800);
    expect(computeVisiblePage(m)).toBe(1);
  });

  it("picks a short last page when it dominates at the document bottom", () => {
    const pages = stackedPages([1000, 1000, 200]);
    const last = pages[2]!;
    // Viewport of 300 at max scroll: all 200px of the last page visible,
    // less of the tail of the penultimate page.
    const contentBottom = last.y + last.height + 10;
    const m = metricsFor(pages, contentBottom - 300, 300);
    expect(computeVisiblePage(m)).toBe(2);
  });

  it("falls back to the nearest centre when no page intersects", () => {
    // 300px gaps and a 100px viewport sitting inside the gap between pages
    // 2 and 3, closer to page 3's centre.
    const pages = stackedPages([400, 400, 400], 300);
    const p2 = pages[1]!;
    const gapStart = p2.y + p2.height;
    const m = metricsFor(pages, gapStart + 190, 100);
    expect(computeVisiblePage(m)).toBe(2);
  });

  it("returns null when no pages are laid out", () => {
    const m = metricsFor([], 0, 800);
    expect(computeVisiblePage(m)).toBeNull();
  });
});
