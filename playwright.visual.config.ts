import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages',
  testMatch: '**/*.visual.test.ts',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npx serve . -p 5173',
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
});
