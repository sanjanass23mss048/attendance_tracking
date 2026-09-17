// @ts-check
import { defineConfig, devices } from '@playwright/test';

const baseURL = (
  (process.env.E2E_BASE_URL || '').trim() ||
  'http://127.0.0.1:4000/'
).replace(/\/?$/, '/');

const skipWebServer = Boolean((process.env.E2E_SKIP_WEBSERVER || '').trim());

/**
 * E2E against a local production build (Vite dist + Express on :4000).
 * CI builds the app, seeds Postgres, then Playwright starts the server via webServer.
 * Set E2E_SKIP_WEBSERVER=1 to hit an already-running server or a remote URL.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(process.env.CI ? [['github']] : []),
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
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run start:prod --prefix server',
        url: 'http://127.0.0.1:4000/health',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: process.env.PORT || '4000',
          CLIENT_ORIGIN:
            process.env.CLIENT_ORIGIN ||
            'http://127.0.0.1:4000,http://localhost:4000',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
