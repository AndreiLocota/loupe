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

function load(page: Page, path: string): Promise<string> {
  return page.evaluate(
    (p) => (window as unknown as { __load(p: string): Promise<string> }).__load(p),
    path,
  );
}

function trackExternal(page: Page): string[] {
  const external: string[] = [];
  page.on('request', (req) => {
    try {
      const url = new URL(req.url());
      if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.hostname !== 'localhost' && !url.hostname.startsWith('127.')
      ) {
        external.push(req.url());
      }
    } catch { /* skip */ }
  });
  return external;
}

test.describe('DOCX adapter security (real adapter, canvas engine)', () => {
  test.beforeEach(async ({ page }) => { await ready(page); });

  test('renders a benign DOCX to canvas in-document — no iframe, no injected markup', async ({ page }) => {
    const result = await load(page, '/corpus/production/simple.docx');
    expect(result).toBe('loaded');

    // The 2.x sandbox iframe is gone; document content is drawn to canvas, so
    // there is no HTML injection surface to sandbox.
    await expect(page.locator('#viewer iframe')).toHaveCount(0);
    expect(await page.locator('#viewer canvas').count()).toBeGreaterThan(0);
    // Document text reaches the DOM only through the engine's inert selection
    // overlay (transparent spans), never as document-authored markup.
    await expect(page.locator('#viewer script')).toHaveCount(0);
  });

  test('remote-image DOCX makes no request to the external beacon', async ({ page }) => {
    const external = trackExternal(page);

    await load(page, '/corpus/malicious/docx-remote-images.docx');
    await page.waitForTimeout(500);

    expect(external.filter((u) => u.includes('evil.example.com'))).toHaveLength(0);
    expect(external).toHaveLength(0);
  });

  test('javascript: hyperlink triggers no dialog, no navigation, no link-click relay', async ({ page }) => {
    let dialog = false;
    page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    let navigated = false;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigated = true; });

    await page.evaluate(() => {
      const w = window as unknown as { __linkClicks: unknown[] };
      w.__linkClicks = [];
      window.addEventListener('message', (e) => {
        if ((e.data as { type?: string })?.type === 'link-click') {
          w.__linkClicks.push((e.data as { url?: string }).url);
        }
      });
    });

    await load(page, '/corpus/malicious/docx-javascript-hyperlink.docx');
    await page.waitForTimeout(500);

    // The hyperlink is mirrored into the selection overlay with its target in
    // `title` — click it for real, not just load-time evaluation. The span must
    // exist: a silent skip here would pass the test without exercising the
    // click path at all.
    const link = page.locator('#viewer span[title^="javascript:"]');
    await expect(link.first()).toBeAttached({ timeout: 10000 });
    await link.first().click({ force: true });
    await page.waitForTimeout(300);

    expect(dialog).toBe(false);
    expect(navigated).toBe(false);
    expect(
      await page.evaluate(
        () => (window as unknown as { __linkClicks: unknown[] }).__linkClicks,
      ),
    ).toHaveLength(0);
  });

  test('a malicious zip (bomb / traversal) is rejected, never rendered', async ({ page }) => {
    for (const file of ['zipped-zero-bomb.zip', 'zip-path-traversal.zip']) {
      const result = await load(page, `/corpus/malicious/${file}`);
      expect(result, `${file} must not load`).toBe('error');
    }
  });
});

// The engine compiles WASM and spawns Web Workers, so strict-CSP consumers
// need `script-src 'wasm-unsafe-eval'` and `worker-src 'self'`. Serve the
// fixture under exactly the CSP the README documents and prove a document
// still loads. (`unsafe-inline` is fixture plumbing — its import map and
// bootstrap script are inline; the library itself needs no inline script.)
test.describe('DOCX under a strict CSP', () => {
  const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
  ].join('; ');

  test('loads and renders with wasm-unsafe-eval + worker-src self', async ({ page }) => {
    await page.route('**/viewer-test.html', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        body: await response.text(),
        headers: {
          ...response.headers(),
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': CSP,
        },
      });
    });

    await ready(page);
    const result = await load(page, '/corpus/production/simple.docx');
    expect(result).toBe('loaded');
    expect(await page.locator('#viewer canvas').count()).toBeGreaterThan(0);
  });
});
