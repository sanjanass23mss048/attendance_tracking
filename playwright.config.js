// @ts-check
import { defineConfig, devices } from '@playwright/test';

const baseURL = (
  (process.env.E2E_BASE_URL || '').trim() ||
  'https://st-mary.rioassetmanagement.info/'
).replace(/\/?$/, '/');

/**
 * E2E against a deployed Presence school (default: St. Mary).
 * Override with E2E_BASE_URL / E2E_EMAIL / E2E_PASSWORD.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['github'],
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
