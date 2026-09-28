import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages',
  testMatch: '**/*.browser.test.ts',
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
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: (process.env.CI ? 1 : undefined) as unknown as number,
});
