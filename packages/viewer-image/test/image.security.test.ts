import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/test/fixtures/viewer-test.html';

async function ready(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__viewerReady === true,
    undefined,
    { timeout: 10000 },
  );
}

test.describe('Image adapter security (real adapter, malicious SVG corpus)', () => {
  test.beforeEach(async ({ page }) => { await ready(page); });

  // Each malicious SVG is loaded through the REAL image adapter (blob <img>,
  // "secure static mode"): its script must not run, no dialog, no external fetch.
  for (const file of ['svg-script.svg', 'svg-foreignobject.svg', 'svg-remote-refs.svg']) {
    test(`${file} renders inert (no script, no dialog, no external request)`, async ({ page }) => {
      let dialog = false;
      page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });

      const external: string[] = [];
      page.on('request', (req) => {
        try {
          const url = new URL(req.url());
          // Only count real network fetches to other origins; blob:/data: URLs
          // (the local image display) are same-document and not exfiltration.
          if (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            url.hostname !== 'localhost' && !url.hostname.startsWith('127.')
          ) {
            external.push(req.url());
          }
        } catch { /* skip */ }
      });

      const result = await page.evaluate(
        (f) => (window as unknown as { __load(p: string): Promise<string> }).__load(`/corpus/malicious/${f}`),
        file,
      );
      await page.waitForTimeout(500);

      // The SVG's embedded <script> only sets this flag; in an <img> it never runs.
      const scriptRan = await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__svgScriptExecuted === true,
      );

      expect(result).toBe('loaded');   // valid SVG renders (inertly)
      expect(scriptRan).toBe(false);
      expect(dialog).toBe(false);
      expect(external).toHaveLength(0);
    });
  }
});

test.describe('Image adapter rendering (real adapter, benign corpus)', () => {
  test.beforeEach(async ({ page }) => { await ready(page); });

  test('renders a benign PNG', async ({ page }) => {
    const result = await page.evaluate(
      () => (window as unknown as { __load(p: string): Promise<string> }).__load('/corpus/production/minimal.png'),
    );
    expect(result).toBe('loaded');
    await expect(page.locator('#viewer img')).toHaveCount(1);
  });

  test('decodes a multi-page TIFF via the real worker', async ({ page }) => {
    const result = await page.evaluate(
      () => (window as unknown as { __load(p: string): Promise<string> }).__load('/corpus/production/multipage.tiff'),
    );
    expect(result).toBe('loaded');

    const pageCount = await page.evaluate(() => {
      const s = (window as unknown as { __viewerStore: { getState(): { document: { pageCount: number } | null } } }).__viewerStore;
      return s.getState().document?.pageCount ?? 0;
    });
    expect(pageCount).toBe(3);
  });
});
