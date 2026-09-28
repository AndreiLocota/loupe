import { describe, expect, it } from "vitest";
import type { ViewportMetrics } from "../src/adapters/DocumentAdapter.js";
import {
  computeScrollTarget,
  projectRect,
  unionRects,
} from "../src/viewport/project.js";

// A page 100×150 (native) at scale 2, positioned at (10,20) in content space.
function metrics(
  rotation: number,
  width: number,
  height: number,
): ViewportMetrics {
  return {
    scale: 2,
    rotation,
    scroll: { x: 0, y: 0 },
    content: { width: 1000, height: 1000 },
    client: { width: 800, height: 600 },
    devicePixelRatio: 1,
    unit: "pt",
    pages: [
      {
        index: 0,
        x: 10,
        y: 20,
        width,
        height,
        nativeWidth: 100,
        nativeHeight: 150,
      },
    ],
  };
}

const RECT = { x: 5, y: 5, width: 10, height: 20 };

describe("projectRect", () => {
  it("maps a native rect at rotation 0 (identity + scale + offset)", () => {
    const cr = projectRect(metrics(0, 200, 300), 0, RECT);
    expect(cr).toEqual({ x: 10 + 5 * 2, y: 20 + 5 * 2, width: 20, height: 40 });
  });

  it("rotates the rect 90° within the page and swaps w/h", () => {
    // At 90° the on-screen page box is nativeHeight×nativeWidth (300×200).
    const cr = projectRect(metrics(90, 300, 200), 0, RECT);
    // rlx = Hn-(y+h)=150-25=125, rly=x=5, rw=h=20, rh=w=10
    expect(cr).toEqual({
      x: 10 + 125 * 2,
      y: 20 + 5 * 2,
      width: 40,
      height: 20,
    });
  });

  it("mirrors the rect at 180°", () => {
    const cr = projectRect(metrics(180, 200, 300), 0, RECT);
    // rlx = Wn-(x+w)=100-15=85, rly = Hn-(y+h)=150-25=125
    expect(cr).toEqual({
      x: 10 + 85 * 2,
      y: 20 + 125 * 2,
      width: 20,
      height: 40,
    });
  });

  it("subtracts scroll offset", () => {
    const m = metrics(0, 200, 300);
    m.scroll = { x: 30, y: 40 };
    const cr = projectRect(m, 0, RECT);
    expect(cr).toEqual({
      x: 10 + 10 - 30,
      y: 20 + 10 - 40,
      width: 20,
      height: 40,
    });
  });

  it("returns null for an unknown page", () => {
    expect(projectRect(metrics(0, 200, 300), 5, RECT)).toBeNull();
  });
});

describe("unionRects", () => {
  it("returns null for an empty list", () => {
    expect(unionRects([])).toBeNull();
  });

  it("returns the rect itself for a single-element list", () => {
    expect(unionRects([RECT])).toEqual(RECT);
  });

  it("unions disjoint rects into the smallest covering rect", () => {
    const u = unionRects([
      { x: 0, y: 10, width: 10, height: 5 },
      { x: 20, y: 0, width: 5, height: 30 },
    ]);
    expect(u).toEqual({ x: 0, y: 0, width: 25, height: 30 });
  });
});

describe("computeScrollTarget", () => {
  // A taller layout than the projectRect fixture so vertical targets aren't
  // all clamped to 0: page at (10, 1000) in a 1000×2000 content, 800×600 client.
  function scrollMetrics(scroll: { x: number; y: number }): ViewportMetrics {
    return {
      scale: 2,
      rotation: 0,
      scroll,
      content: { width: 1000, height: 2000 },
      client: { width: 800, height: 600 },
      devicePixelRatio: 1,
      unit: "pt",
      pages: [
        {
          index: 0,
          x: 10,
          y: 1000,
          width: 200,
          height: 300,
          nativeWidth: 100,
          nativeHeight: 150,
        },
      ],
    };
  }

  it("centers the rect in the viewport", () => {
    // Content coords of RECT: cx = 10 + 5·2 = 20, cy = 1000 + 5·2 = 1010; 20×40.
    const t = computeScrollTarget(scrollMetrics({ x: 0, y: 0 }), 0, RECT);
    // top = 1010 − (600 − 40)/2 = 730; left = 20 − 390 clamps to 0.
    expect(t).toEqual({ left: 0, top: 730 });
  });

  it("is scroll-invariant (same target while a smooth scroll is mid-flight)", () => {
    const a = computeScrollTarget(scrollMetrics({ x: 0, y: 0 }), 0, RECT);
    const b = computeScrollTarget(scrollMetrics({ x: 123, y: 456 }), 0, RECT);
    expect(b).toEqual(a);
  });

  it("aligns to 'start' with edge padding", () => {
    const t = computeScrollTarget(
      scrollMetrics({ x: 0, y: 0 }),
      0,
      RECT,
      "start",
    );
    expect(t).toEqual({ left: 4, top: 994 }); // cx − 16, cy − 16
  });

  it("delegates rotation to projectRect", () => {
    const m = scrollMetrics({ x: 40, y: 50 });
    m.rotation = 90;
    m.pages[0]!.width = 300;
    m.pages[0]!.height = 200;
    const p = projectRect(m, 0, RECT)!;
    const t = computeScrollTarget(m, 0, RECT, "start")!;
    const maxLeft = m.content.width - m.client.width;
    const maxTop = m.content.height - m.client.height;
    expect(t.left).toBe(Math.min(Math.max(0, p.x + m.scroll.x - 16), maxLeft));
    expect(t.top).toBe(Math.min(Math.max(0, p.y + m.scroll.y - 16), maxTop));
  });

  it("clamps to the end of the scrollable range", () => {
    const m = scrollMetrics({ x: 0, y: 0 });
    m.content = { width: 1000, height: 1200 }; // maxTop = 600
    const t = computeScrollTarget(m, 0, { x: 5, y: 140, width: 10, height: 5 });
    // cy = 1000 + 140·2 = 1280 → centered top ≫ maxTop → clamp.
    expect(t).toEqual({ left: 0, top: 600 });
  });

  it("pins to 0 when the content is smaller than the client", () => {
    const m = scrollMetrics({ x: 0, y: 0 });
    m.content = { width: 400, height: 300 };
    m.pages[0]!.y = 20;
    const t = computeScrollTarget(m, 0, RECT);
    expect(t).toEqual({ left: 0, top: 0 });
  });

  it("returns null when the page is not laid out", () => {
    expect(
      computeScrollTarget(scrollMetrics({ x: 0, y: 0 }), 7, RECT),
    ).toBeNull();
  });
});
