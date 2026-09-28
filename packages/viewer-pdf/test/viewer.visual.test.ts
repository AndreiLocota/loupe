import { expect, test } from "@playwright/test";

const FIXTURE = "/test/fixtures/viewer-test.html";

test.describe("Visual regression (real PDF adapter)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test("PDF multipage renders with correct layout", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });
    await page.waitForTimeout(1000);

    const viewer = page.locator("#viewer");
    await expect(viewer).toHaveScreenshot("viewer-pdf-real-multipage.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  test("viewer toolbar with loaded document", async ({ page }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });

    const toolbar = page.locator("#toolbar");
    await expect(toolbar).toHaveScreenshot("viewer-toolbar-loaded.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("empty viewer shows idle state", async ({ page }) => {
    const viewer = page.locator("#viewer");
    await expect(viewer).toHaveScreenshot("viewer-idle-real.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("active search match is emphasised distinctly from other matches", async ({
    page,
  }) => {
    await page.click("#btn-load");
    await page.waitForSelector(".loupe-pdf-page", { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 'Page' matches on every page of the 3-page corpus PDF; the commit makes
    // match 0 active (orange + outline) while the rest stay yellow.
    await page.evaluate(async () => {
      const store = (
        window as unknown as {
          __viewerStore: { search(q: string): Promise<void> };
        }
      ).__viewerStore;
      await store.search("Page");
    });
    await page.waitForSelector(".loupe-search-highlight-active", {
      timeout: 10000,
    });
    await page.waitForTimeout(500); // let the scroll settle

    const viewer = page.locator("#viewer");
    await expect(viewer).toHaveScreenshot("viewer-active-search-match.png", {
      maxDiffPixelRatio: 0.1,
    });
  });
});
