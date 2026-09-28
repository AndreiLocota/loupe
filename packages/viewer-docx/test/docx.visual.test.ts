import { expect, type Page, test } from "@playwright/test";

const FIXTURE = "/test/fixtures/viewer-test.html";

// Canvas output is deterministic per engine version (@silurus/ooxml is pinned
// exactly), so golden screenshots are the regression tool for DOCX rendering —
// they were useless when 2.x rendered engine-styled HTML in an iframe.
async function ready(page: Page, corpusPath: string): Promise<void> {
  await page.goto(FIXTURE);
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__viewerReady === true,
    undefined,
    { timeout: 10000 },
  );
  // The canvas engine sizes itself from the mount; the shared fixture leaves
  // #viewer auto-height for the in-flow PDF tests.
  await page.evaluate(() => {
    (document.getElementById("viewer") as HTMLElement).style.height = "600px";
  });
  const status = await page.evaluate(
    (path) =>
      (window as unknown as { __load(p: string): Promise<string> }).__load(
        path,
      ),
    corpusPath,
  );
  expect(status).toBe("loaded");
  await page.waitForSelector("#viewer canvas", { timeout: 15000 });
  await page.waitForTimeout(1000); // let render slots settle
}

test.describe("Visual regression (real DOCX adapter, canvas engine)", () => {
  test("simple document renders paginated text", async ({ page }) => {
    await ready(page, "/corpus/production/simple.docx");
    await expect(page.locator("#viewer")).toHaveScreenshot(
      "docx-simple.png",
      { maxDiffPixelRatio: 0.02 },
    );
  });

  test("tables render with borders and cell text", async ({ page }) => {
    await ready(page, "/corpus/production/tables.docx");
    await expect(page.locator("#viewer")).toHaveScreenshot(
      "docx-tables.png",
      { maxDiffPixelRatio: 0.02 },
    );
  });

  test("search highlights paint with a distinct active match", async ({
    page,
  }) => {
    await ready(page, "/corpus/production/search-repeats.docx");
    await page.evaluate(async () => {
      const store = (
        window as unknown as {
          __viewerStore: { search(q: string): Promise<void> };
        }
      ).__viewerStore;
      await store.search("repeated search phrase");
    });
    await page.waitForTimeout(1000); // let the highlight paint + scroll settle
    // Wider tolerance than the static goldens: the scroll-settle position and
    // font rasterisation vary slightly across platforms (macOS goldens vs
    // Linux CI), which the search-commit scroll amplifies — same allowance as
    // the PDF active-search golden.
    await expect(page.locator("#viewer")).toHaveScreenshot(
      "docx-search-active.png",
      { maxDiffPixelRatio: 0.1 },
    );
  });
});
