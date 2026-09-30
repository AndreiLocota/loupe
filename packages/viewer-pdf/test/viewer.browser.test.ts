import { expect, test } from "@playwright/test";

const FIXTURE = "/test/fixtures/viewer-test.html";

test.describe("Viewer browser integration (real PDF adapter)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test("fixture loads and initial state is idle", async ({ page }) => {
    const status = await page.textContent("#status");
    expect(status).toContain("Idle");
  });

  test("loads a real PDF and transitions to loaded", async ({ page }) => {
    await page.click("#btn-load");
    // Wait for loaded status — PDF.js loads async
    await page.waitForFunction(
      () => {
        const store = (window as unknown as Record<string, unknown>)
          .__viewerStore as {
          getState(): { status: string };
        };
        return store?.getState?.()?.status === "loaded";
      },
      undefined,
      { timeout: 15000 },
    );

    const state = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): Record<string, unknown>;
      };
      return store.getState();
    });

    expect(state.status).toBe("loaded");
    expect(state.format).toBe("pdf");
    expect((state.document as Record<string, unknown>)?.pageCount).toBe(3);
  });

  test("renders PDF pages with loupe-pdf-page containers", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForFunction(
      () => {
        const store = (window as unknown as Record<string, unknown>)
          .__viewerStore as {
          getState(): { status: string };
        };
        return store?.getState?.()?.status === "loaded";
      },
      undefined,
      { timeout: 15000 },
    );

    // Wait for page containers to appear
    await page.waitForSelector(".loupe-pdf-page", { timeout: 10000 });

    const pageCount = await page.locator(".loupe-pdf-page").count();
    expect(pageCount).toBe(3);

    // Verify canvases are present
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBeGreaterThanOrEqual(1);
  });

  test("page navigation works", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });

    const initialPage = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): { currentPage: number };
      };
      return store.getState().currentPage;
    });
    expect(initialPage).toBe(1);

    await page.click("#btn-next");
    await page.waitForTimeout(500);

    const nextPage = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): { currentPage: number };
      };
      return store.getState().currentPage;
    });
    expect(nextPage).toBe(2);

    await page.click("#btn-prev");
    await page.waitForTimeout(500);

    const prevPage = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): { currentPage: number };
      };
      return store.getState().currentPage;
    });
    expect(prevPage).toBe(1);
  });

  test("closes document and cleans up", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });

    await page.click("#btn-close");
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): Record<string, unknown>;
      };
      return store.getState();
    });
    expect(state.status).toBe("idle");
    expect(state.document).toBeNull();

    const pageElements = await page.locator(".loupe-pdf-page").count();
    expect(pageElements).toBe(0);
  });

  test("search finds text in PDF", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });

    // Wait a bit for text layer to render
    await page.waitForTimeout(2000);

    await page.fill("#search-input", "Page");
    await page.click("#btn-search");
    await page.waitForTimeout(2000);

    const matchesText = await page.textContent("#search-count");
    expect(matchesText).toContain("matches");
  });

  test("zoom changes scale", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });

    await page.click("#btn-zoom-in");
    await page.waitForTimeout(500);

    const zoom = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>)
        .__viewerStore as {
        getState(): { zoom: number };
      };
      return store.getState().zoom;
    });
    expect(zoom).toBeGreaterThan(1.5);
  });
});

// ── Scroll-to-search-match (VDX-175) ─────────────────────────────────────────
// These exercise real layout: page pre-sizing, precise scrolling on a long
// document, and active-match emphasis. jsdom can't assert any of this.

interface StoreHandle {
  getState(): {
    status: string;
    currentPage: number;
    searchMatches: { pageIndex: number }[];
    activeSearchMatchIndex: number;
  };
  getViewport(): {
    scroll: { x: number; y: number };
    client: { width: number; height: number };
    pages: { index: number; y: number; height: number }[];
  } | null;
  goToPage(n: number): void;
  search(q: string): Promise<void>;
  nextSearchMatch(): void;
  scrollToSearchMatch(i?: number): Promise<void>;
  setZoom(z: number): void;
  subscribe(cb: (e: { type: string; page?: number }) => void): () => void;
}

// NOTE: page.evaluate/waitForFunction callbacks are serialised and run in the
// browser, so they cannot close over Node-side helpers — each one re-reads
// window.__viewerStore inline.
declare global {
  interface Window {
    __viewerStore: StoreHandle;
    __load(path: string): Promise<string>;
  }
}

test.describe("Scroll to search match (VDX-175, real layout)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(async () => {
      await window.__load("/corpus/production/large-20page.pdf");
    });
    await page.waitForFunction(
      () => window.__viewerStore?.getState().status === "loaded",
      undefined,
      { timeout: 15000 },
    );
  });

  test("goToPage reaches the last page of a long document", async ({
    page,
  }) => {
    // Regression for the root cause: unsized page slots made scrollIntoView
    // stop around page 13 of a long document. Fails on the previous release.
    await page.evaluate(() => window.__viewerStore.goToPage(20));

    await page.waitForFunction(
      () => {
        const vp = window.__viewerStore.getViewport();
        const last = vp?.pages.find((p) => p.index === 19);
        if (!vp || !last) return false;
        // Page 20 intersects the viewport.
        return (
          last.y < vp.scroll.y + vp.client.height &&
          last.y + last.height > vp.scroll.y
        );
      },
      undefined,
      { timeout: 10000 },
    );
  });

  test("stepping to a match on a far page scrolls to it and emphasises it", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("Large");
    });
    const matchCount = await page.evaluate(
      () => window.__viewerStore.getState().searchMatches.length,
    );
    expect(matchCount).toBe(20); // one per page

    await page.evaluate(async () => {
      await window.__viewerStore.scrollToSearchMatch(19); // page 20's match
    });

    // The active highlight renders on the (previously unrendered) target page
    // and ends up inside the viewport.
    const active = page.locator(".loupe-search-highlight-active");
    await expect(active).toHaveCount(1, { timeout: 10000 });
    await expect(active).toHaveAttribute("data-loupe-match", "19");

    const viewerBox = await page.locator("#viewer").boundingBox();
    const activeBox = await active.boundingBox();
    expect(viewerBox).not.toBeNull();
    expect(activeBox).not.toBeNull();
    expect(activeBox!.y).toBeGreaterThanOrEqual(viewerBox!.y - 1);
    expect(activeBox!.y + activeBox!.height).toBeLessThanOrEqual(
      viewerBox!.y + viewerBox!.height + 1,
    );
  });

  test("exactly one match is emphasised and stepping moves the emphasis", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("Large");
    });

    // Search commit lands on match 0.
    const active = page.locator(".loupe-search-highlight-active");
    await expect(active).toHaveCount(1, { timeout: 10000 });
    await expect(active).toHaveAttribute("data-loupe-match", "0");

    await page.evaluate(() => window.__viewerStore.nextSearchMatch());
    await expect(active).toHaveCount(1, { timeout: 10000 });
    await expect(active).toHaveAttribute("data-loupe-match", "1");
  });

  test("highlights and the active emphasis survive zoom", async ({ page }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("Large");
    });
    const active = page.locator(".loupe-search-highlight-active");
    await expect(active).toHaveCount(1, { timeout: 10000 });

    await page.evaluate(() => window.__viewerStore.setZoom(2));

    // The re-rendered page repaints highlights and re-applies the emphasis.
    await expect(active).toHaveCount(1, { timeout: 10000 });
    await expect(active).toHaveAttribute("data-loupe-match", "0");
  });
});

// ── Scroll-tracked current page (VDX-188) ─────────────────────────────────────
// The repro: scrolling a long document by hand left currentPage stuck at 1, so
// the page indicator lied and next-page jumped back to 2. These need real
// scroll events and real page layout — jsdom has neither.

test.describe("Scroll-tracked current page (VDX-188, real layout)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
    // The fixture's #viewer grows with its content (the page scrolls at the
    // window level), so the adapter's scroll container never scrolls and no
    // viewport events fire. Pin the mount height so scrolling is internal,
    // like an embedding app's bounded viewer pane.
    await page.evaluate(() => {
      const viewer = document.getElementById("viewer");
      if (viewer) viewer.style.height = "800px";
    });
    await page.evaluate(async () => {
      await window.__load("/corpus/production/large-20page.pdf");
    });
    await page.waitForFunction(
      () => window.__viewerStore?.getState().status === "loaded",
      undefined,
      { timeout: 15000 },
    );
  });

  test("scrolling to page 5 updates currentPage; next-page then lands on 6", async ({
    page,
  }) => {
    // Scroll the real container so page 5 dominates the viewport. The
    // adapter's initial-page snap can reset a scroll issued before its
    // measurement pass settles, so keep re-issuing the scroll (as a user
    // would) until tracking reports page 5, then navigate in the same task —
    // synchronous, so the snap can't interleave between read and goToPage.
    const target = await page.evaluate(async () => {
      const store = window.__viewerStore;
      const sc = document.querySelector(".loupe-pdf-scroll");
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 100 && store.getState().currentPage !== 5; i++) {
        const p5 = store.getViewport()?.pages.find((p) => p.index === 4);
        if (p5 && sc) sc.scrollTop = p5.y;
        await sleep(100);
      }
      if (store.getState().currentPage !== 5) return -1;
      // Next-page must move from the SCROLLED position, not a stale page 1.
      store.goToPage(store.getState().currentPage + 1);
      return 6;
    });
    expect(target).toBe(6);

    await page.waitForFunction(
      () => {
        if (window.__viewerStore.getState().currentPage !== 6) return false;
        const vp = window.__viewerStore.getViewport();
        const p6 = vp?.pages.find((p) => p.index === 5);
        if (!vp || !p6) return false;
        // Page 6's rect intersects the viewport.
        return (
          p6.y < vp.scroll.y + vp.client.height &&
          p6.y + p6.height > vp.scroll.y
        );
      },
      undefined,
      { timeout: 10000 },
    );
  });

  test("goToPage(20) emits no intermediate page-change while it scrolls", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const events: number[] = [];
      (window as unknown as Record<string, unknown>).__pageEvents = events;
      window.__viewerStore.subscribe((e) => {
        if (e.type === "page-change" && typeof e.page === "number")
          events.push(e.page);
      });
      window.__viewerStore.goToPage(20);
    });

    // Poll until the scroll has settled on page 20 (same shape as the VDX-175
    // navigation test) before judging the emitted events.
    await page.waitForFunction(
      () => {
        if (window.__viewerStore.getState().currentPage !== 20) return false;
        const vp = window.__viewerStore.getViewport();
        const last = vp?.pages.find((p) => p.index === 19);
        if (!vp || !last) return false;
        return (
          last.y < vp.scroll.y + vp.client.height &&
          last.y + last.height > vp.scroll.y
        );
      },
      undefined,
      { timeout: 10000 },
    );
    // Let any straggling scroll events drain, then assert nothing between the
    // start and the target ever surfaced.
    await page.waitForTimeout(500);

    const events = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__pageEvents as number[],
    );
    expect(events).toContain(20);
    expect(events.filter((p) => p >= 2 && p <= 19)).toEqual([]);
  });
});

// ── Stitched search across item boundaries (VDX-245) ──────────────────────────
// pdf.js ends a text item at every font change and line end, so a phrase that
// crosses either never sits in one item. The fixture's first line splits
// "POLICY EXCESS WAIVER" across five items (bold EXCESS); its second phrase
// wraps onto a new line. Highlight boxes need real layout — jsdom's
// Range.getClientRects() is empty — so painted-ordinal assertions live here.

test.describe("Stitched search across item boundaries (VDX-245)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(async () => {
      await window.__load("/corpus/production/search-stress.pdf");
    });
    await page.waitForFunction(
      () => window.__viewerStore?.getState().status === "loaded",
      undefined,
      { timeout: 15000 },
    );
  });

  test("phrase spanning a style change and a line wrap is found and painted", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("POLICY EXCESS WAIVER");
    });

    // Two occurrences: the bold-split line and the wrapped phrase.
    const matchCount = await page.evaluate(
      () => window.__viewerStore.getState().searchMatches.length,
    );
    expect(matchCount).toBe(2);

    // Every box carries a match ordinal; distinct ordinals equal the count,
    // so the counter and the painted highlights cannot drift apart.
    const boxes = page.locator(".loupe-search-highlight");
    await expect
      .poll(async () => {
        const ordinals = await boxes.evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.loupeMatch),
        );
        return new Set(ordinals).size;
      })
      .toBe(2);

    // The bold-split match paints one box per item it crosses (all three
    // words), the wrapped match one box per line.
    const perOrdinal = await boxes.evaluateAll((els) => {
      const counts: Record<string, number> = {};
      for (const el of els) {
        const key = (el as HTMLElement).dataset.loupeMatch ?? "?";
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    });
    expect(perOrdinal["0"]).toBeGreaterThanOrEqual(3);
    expect(perOrdinal["1"]).toBe(2);
  });

  test("a wrapped match counts once and both its boxes activate together", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("POLICY EXCESS WAIVER");
      await window.__viewerStore.scrollToSearchMatch(1); // the wrapped match
    });

    const active = page.locator(".loupe-search-highlight-active");
    await expect(active).toHaveCount(2, { timeout: 10000 });
    for (const el of await active.all()) {
      await expect(el).toHaveAttribute("data-loupe-match", "1");
    }
  });

  test("single-style, single-line searches are unchanged", async ({ page }) => {
    await page.evaluate(async () => {
      await window.__viewerStore.search("UNSPLIT CONTROL PHRASE");
    });

    const matchCount = await page.evaluate(
      () => window.__viewerStore.getState().searchMatches.length,
    );
    expect(matchCount).toBe(1);

    const boxes = page.locator(".loupe-search-highlight");
    await expect(boxes).toHaveCount(1, { timeout: 10000 });
    await expect(boxes.first()).toHaveAttribute("data-loupe-match", "0");
  });
});
