import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const includeWebkit = process.env.PLAYWRIGHT_INCLUDE_WEBKIT === '1';

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
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    testIdAttribute: 'data-testid',
  },
  webServer: {
    command: 'pnpm --filter @do-epub-studio/web dev --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
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
  ],
});
