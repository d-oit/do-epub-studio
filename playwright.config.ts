import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const includeWebkit = process.env.PLAYWRIGHT_INCLUDE_WEBKIT === '1';
const mode = process.env.PLAYWRIGHT_MODE || 'dev';
const isPreview = mode === 'preview';
const port = isPreview ? 4173 : 5173;

export default defineConfig({
  testDir: './apps',
  testMatch: ['**/*.spec.ts'],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  outputDir: 'test-results/playwright',
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    testIdAttribute: 'data-testid',
    // Disable the service worker so route mocks can intercept API
    // requests consistently across browsers (Chromium, Firefox, and
    // WebKit all handle SW interception differently; this normalizes).
    serviceWorkers: 'block',
  },
  webServer: {
    command: isPreview
      ? `pnpm --filter @do-epub-studio/web preview --host 127.0.0.1 --port ${port}`
      : `pnpm --filter @do-epub-studio/web dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      // Enable client telemetry at info level so E2E tests can wait for
      // `reader.progress_loaded` and similar events. Production deploys
      // keep the default warn level via VITE_LOG_LEVEL.
      VITE_LOG_LEVEL: 'info',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    ...(includeWebkit
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
      grep: /@mobile/,
    },
    {
      name: 'pixel',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
  ],
});
