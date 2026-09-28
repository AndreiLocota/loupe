import { expect, type Page, test } from "@playwright/test";

const FIXTURE = "/test/fixtures/viewer-test.html";
// 5 occurrences in corpus/production/search-repeats.docx, spread by filler
// paragraphs so stepping between matches must scroll the viewport.
const TERM = "repeated search phrase";
const OCCURRENCES = 5;

// NOTE: page.evaluate/waitForFunction callbacks are serialised and run in the
// browser, so they cannot close over Node-side helpers — each one re-reads
// window.__viewerStore inline through a local cast (a `declare global` here
// would clash with the one in viewer.browser.test.ts).
interface StoreHandle {
  getState(): {
    status: string;
    currentPage: number;
    searchMatches: { pageIndex: number; bounds: unknown[] }[];
    activeSearchMatchIndex: number;
    document: { pageCount: number } | null;
  };
  getViewport(): {
    scale: number;
    content: { width: number; height: number };
    client: { width: number; height: number };
    pages: { index: number; width: number }[];
  } | null;
  search(q: string): Promise<void>;
  nextSearchMatch(): void;
  previousSearchMatch(): void;
  scrollToSearchMatch(i?: number): Promise<void>;
  setZoom(z: number | string): void;
  goToPage(n: number): void;
}
type StoreWindow = { __viewerStore: StoreHandle };

async function ready(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__viewerReady === true,
    undefined,
    { timeout: 10000 },
  );
  // The canvas engine sizes itself from the mount, so give it a real viewport
  // (the shared fixture leaves #viewer auto-height for the in-flow PDF tests).
  await page.evaluate(() => {
    (document.getElementById("viewer") as HTMLElement).style.height = "600px";
  });
  const status = await page.evaluate(
    (path) =>
      (window as unknown as { __load(p: string): Promise<string> }).__load(
        path,
      ),
    "/corpus/production/search-repeats.docx",
  );
  expect(status).toBe("loaded");
}

function search(page: Page, term: string): Promise<void> {
  return page.evaluate(
    (q) => (window as unknown as StoreWindow).__viewerStore.search(q),
    term,
  );
}

function matchCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as StoreWindow).__viewerStore.getState().searchMatches
        .length,
  );
}

function activeIndex(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as StoreWindow).__viewerStore.getState()
        .activeSearchMatchIndex,
  );
}

// The engine renders to canvas inside a scroll host it creates within #viewer;
// find it by computed overflow, exactly as the adapter does.
function scrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewer = document.querySelector("#viewer");
    if (!viewer) return 0;
    const els = [viewer, ...viewer.querySelectorAll("div")];
    const host =
      els.find((el) => {
        const o = getComputedStyle(el).overflowY;
        return o === "auto" || o === "scroll";
      }) ?? viewer;
    return host.scrollTop;
  });
}

async function settleScroll(page: Page): Promise<number> {
  await expect
    .poll(async () => {
      const a = await scrollTop(page);
      await page.waitForTimeout(200);
      return Math.abs((await scrollTop(page)) - a);
    })
    .toBeLessThan(1);
  return scrollTop(page);
}

test.describe("DOCX search + navigation (real canvas engine)", () => {
  test.beforeEach(async ({ page }) => {
    await ready(page);
  });

  test("search reports every occurrence with real geometry and page indices", async ({
    page,
  }) => {
    await search(page, TERM);

    expect(await matchCount(page)).toBe(OCCURRENCES);
    const { boundsSizes, pageIndices, pageCount } = await page.evaluate(() => {
      const state = (
        window as unknown as StoreWindow
      ).__viewerStore.getState();
      return {
        boundsSizes: state.searchMatches.map((m) => m.bounds.length),
        pageIndices: state.searchMatches.map((m) => m.pageIndex),
        pageCount: state.document?.pageCount ?? 0,
      };
    });
    // Every match carries real geometry (the store can't navigate without it).
    for (const size of boundsSizes) expect(size).toBeGreaterThan(0);
    // Matches land on real pages, in reading order.
    for (const idx of pageIndices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(pageCount);
    }
    expect([...pageIndices].sort((a, b) => a - b)).toEqual(pageIndices);

    // The engine paints highlight rects for mounted pages as positioned divs.
    const highlights = page.locator("#viewer div[style*='255, 214, 0']");
    expect(await highlights.count()).toBeGreaterThan(0);
  });

  test("next/previous step the active match in document order with wrap-around and scroll", async ({
    page,
  }) => {
    await search(page, TERM);
    expect(await activeIndex(page)).toBe(0);
    const topAtFirst = await settleScroll(page);

    for (let i = 1; i < OCCURRENCES; i++) {
      await page.evaluate(() =>
        (window as unknown as StoreWindow).__viewerStore.nextSearchMatch(),
      );
      await expect.poll(() => activeIndex(page)).toBe(i);
    }
    // The last occurrence sits far below the first — stepping must have
    // scrolled the viewport, not just restyled highlights.
    await expect
      .poll(() => scrollTop(page), { timeout: 10000 })
      .toBeGreaterThan(topAtFirst + 100);

    // Wrap-around forwards: past the last match, back to the first.
    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.nextSearchMatch(),
    );
    await expect.poll(() => activeIndex(page)).toBe(0);
    await expect
      .poll(() => scrollTop(page), { timeout: 10000 })
      .toBeLessThan(topAtFirst + 100);

    // Wrap-around backwards: before the first match, back to the last.
    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.previousSearchMatch(),
    );
    await expect.poll(() => activeIndex(page)).toBe(OCCURRENCES - 1);
  });

  test("count and stepping still agree after zooming", async ({ page }) => {
    await search(page, TERM);
    expect(await activeIndex(page)).toBe(0);

    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.setZoom(2),
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as StoreWindow).__viewerStore.getViewport()
                ?.scale,
          ),
        { timeout: 10000 },
      )
      .toBe(2);

    // Zoom must not disturb the store's matches.
    expect(await matchCount(page)).toBe(OCCURRENCES);

    // Stepping after zoom still scrolls to the right place: bounds are stored
    // in native units and projected against the live scale at scroll time.
    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.scrollToSearchMatch(4),
    );
    await expect.poll(() => activeIndex(page)).toBe(4);
    await expect
      .poll(() => scrollTop(page), { timeout: 10000 })
      .toBeGreaterThan(200);
  });

  test("fit-width sizes the page to the viewport", async ({ page }) => {
    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.setZoom("fit-width"),
    );
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const store = (window as unknown as StoreWindow).__viewerStore;
          const vp = store.getViewport();
          if (!vp || vp.pages.length === 0) return -1;
          return Math.abs((vp.pages[0]?.width ?? 0) - vp.client.width);
        }),
      )
      // Page width tracks the client width modulo the viewer's own padding.
      .toBeLessThan(80);
  });

  test("scrolling tracks the current page", async ({ page }) => {
    const pageCount = await page.evaluate(
      () =>
        (window as unknown as StoreWindow).__viewerStore.getState().document
          ?.pageCount ?? 0,
    );
    // The corpus doc must paginate for this test to mean anything.
    expect(pageCount).toBeGreaterThan(1);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as StoreWindow).__viewerStore.getState()
            .currentPage,
      ),
    ).toBe(1);

    await page.evaluate(() => {
      const viewer = document.querySelector("#viewer");
      if (!viewer) return;
      const els = [viewer, ...viewer.querySelectorAll("div")];
      const host =
        els.find((el) => {
          const o = getComputedStyle(el).overflowY;
          return o === "auto" || o === "scroll";
        }) ?? viewer;
      host.scrollTop = host.scrollHeight;
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as StoreWindow).__viewerStore.getState()
                .currentPage,
          ),
        { timeout: 10000 },
      )
      .toBe(pageCount);
  });

  test("goToPage scrolls to the requested page", async ({ page }) => {
    await page.evaluate(() =>
      (window as unknown as StoreWindow).__viewerStore.goToPage(2),
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as StoreWindow).__viewerStore.getState()
                .currentPage,
          ),
        { timeout: 10000 },
      )
      .toBe(2);
    expect(await scrollTop(page)).toBeGreaterThan(0);
  });

  test("text is natively selectable through the selection overlay", async ({
    page,
  }) => {
    // The engine mirrors canvas text into a transparent DOM layer for native
    // selection. The layer is built when a page's render settles, so poll.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const surfaces = document.querySelectorAll(
              "#viewer [data-ooxml-selection-surface]",
            );
            const selection = window.getSelection();
            if (surfaces.length === 0 || !selection) return "";
            selection.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(surfaces[0] as Node);
            selection.addRange(range);
            return selection.toString();
          }),
        { timeout: 10000 },
      )
      .toContain("repeated search phrase");
  });
});
