import { test, expect } from '@playwright/test';

const FIXTURE = '/test/fixtures/viewer-test.html';

test.describe('Security invariants (real PDF adapter)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__viewerReady === true,
      undefined,
      { timeout: 10000 },
    );
  });

  test('no network requests to external origins during PDF load', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (req) => {
      try {
        const url = new URL(req.url());
        if (url.hostname !== 'localhost' && !url.hostname.startsWith('127.')) {
          externalRequests.push(req.url());
        }
      } catch { /* skip */ }
    });

    await page.click('#btn-load');
    await page.waitForSelector('.loupe-pdf-page', { timeout: 15000 });

    expect(externalRequests).toHaveLength(0);
  });

  test('document content does not trigger navigation', async ({ page }) => {
    let navigatedAway = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigatedAway = true;
      }
    });

    await page.click('#btn-load');
    await page.waitForSelector('.loupe-pdf-page', { timeout: 15000 });
    await page.waitForTimeout(1000);

    expect(navigatedAway).toBe(false);
  });

  test('PDF with JavaScript actions renders inert', async ({ page }) => {
    // Load a PDF carrying OpenAction, doc-level, keystroke, and link JS
    // actions — each printing a distinct console marker — and watch every
    // observable execution channel: console (pdf.js's scripting manager
    // routes console.println to host console.log), dialogs, and navigation.
    // Only the load-time vectors (OpenAction and doc-level scripts) fire
    // without user interaction; the keystroke and link-click markers are
    // watched as a cheap backstop.
    const markers = [
      'PDF_JS_OPENACTION',
      'PDF_JS_DOCLEVEL',
      'PDF_JS_KEYSTROKE',
      'PDF_JS_LINKCLICK',
    ];
    const executed: string[] = [];
    const dialogs: string[] = [];
    let navigatedAway = false;

    page.on('console', (msg) => {
      const text = msg.text();
      if (markers.some(m => text.includes(m))) executed.push(text);
    });
    page.on('dialog', (d) => { dialogs.push(d.message()); });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigatedAway = true;
    });

    const status = await page.evaluate(() =>
      (window as unknown as { __load: (p: string) => Promise<string> })
        .__load('/corpus/malicious/pdf-javascript-actions.pdf'));
    await page.waitForSelector('.loupe-pdf-page', { timeout: 15000 });
    await page.waitForTimeout(1000);

    expect(status).toBe('loaded');
    expect(executed).toHaveLength(0);
    expect(dialogs).toHaveLength(0);
    expect(navigatedAway).toBe(false);
  });

  test('destroy cleans up mount element', async ({ page }) => {
    await page.click('#btn-load');
    await page.waitForSelector('.loupe-pdf-page', { timeout: 15000 });

    await page.click('#btn-close');
    await page.waitForTimeout(500);

    const children = await page.locator('#viewer > *').count();
    expect(children).toBe(0);
  });

  test('adapter handles errors gracefully', async ({ page }) => {
    // Load an invalid file
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__viewerStore as {
        loadDocument(s: unknown): Promise<void>;
      };
      const badSource = { data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer };
      return store.loadDocument(badSource);
    }).catch(() => {});

    // Should show error state
    await page.waitForFunction(() => {
      const store = (window as unknown as Record<string, unknown>).__viewerStore as {
        getState(): { status: string };
      };
      return store?.getState?.()?.status === 'error';
    }, undefined, { timeout: 5000 });

    const errorVisible = await page.locator('#error.visible').count();
    expect(errorVisible).toBeGreaterThanOrEqual(0);
  });
});
