import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// In some sandboxed CI environments a pinned Chromium build is preinstalled
// at a fixed path instead of the revision Playwright expects. If present,
// use it explicitly; otherwise fall back to Playwright's normal browser
// resolution (e.g. after `npx playwright install`).
const sandboxChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium', launchOptions: { executablePath } } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium', launchOptions: { executablePath } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } },
    },
  ],
});
