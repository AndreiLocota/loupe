import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages',
  testMatch: '**/*.security.test.ts',
  use: {
    baseURL: 'http://localhost:5173',
    // NOTE: a page-level CSP is intentionally NOT set here. `extraHTTPHeaders`
    // attaches headers to outgoing *requests*, not server *responses*, so a CSP
    // set that way is a no-op (it never reaches the browser as a policy). The
    // security invariants that a CSP would provide — no external network egress,
    // no dialog/script execution from document content, sandboxed DOCX iframe
    // without allow-same-origin — are asserted directly by the specs in this
    // suite instead. (Enforcing a real page CSP is blocked by the fixture's
    // inline import map, which strict `script-src 'self'` forbids without a hash.)
  },
  webServer: {
    command: 'npx serve . -p 5173',
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  forbidOnly: true,
  workers: 1,
});
