import { test, expect } from '@playwright/test';
import { suppressWorkboxErrors, DEMO_READER } from './fixtures';

// ---------------------------------------------------------------------------
// GOAP-256: Demo-login E2E vertical slice — LIVE worker stack (no mocks).
//
// Unlike apps/tests/demo-login.spec.ts (route-mocked, gated E2E_DEMO_LOGIN=1),
// this spec drives the real Worker demo endpoints on a local Wrangler stack
// (port 8787) against the seeded demo accounts (ADR-233/244).
//
// Prerequisites (one-time setup):
//   1. Worker:   pnpm --filter @do-epub-studio/worker dev   (port 8787)
//      - .dev.vars must define DEMO_LOGIN_ENABLED=1, DEMO_BOOK_SLUG=demo
//      - Local D1 migrations: pnpm --filter @do-epub-studio/worker exec wrangler d1 migrations apply do-epub-studio --local
//      - Seed demo accounts into local D1:
//          DEMO_ACCOUNTS_ENABLED=1 DEMO_ADMIN_PASSWORD=demo-admin-password \
//          DEMO_READER_PASSWORD=demo-reader-password \
//          TURSO_DATABASE_URL=file:<apps/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite> \
//          node scripts/seed-demo-accounts.mjs
//   2. Web:      VITE_DEMO_LOGIN_ENABLED=1 pnpm --filter @do-epub-studio/web dev (port 5173)
//
// Run:  E2E_LIVE_DEMO=1 pnpm exec playwright test apps/tests/demo-login-live.spec.ts --project=chromium
//
// Opt-in gate (mirrors E2E_DEMO_LOGIN): skipped entirely unless
// E2E_LIVE_DEMO=1, so CI's mocked suite is unaffected (CI has no Wrangler
// stack in the e2e job). Credentials mirror fixtures.ts DEMO_READER/DEMO_ADMIN.
//
// Rate-limit caveat: the live Worker's rate limiter is a persistent local DO.
// If you poked the stack manually (curl/browser logins against demo.reader)
// beforehand, the 423 ACCOUNT_LOCKED lockout may already be armed. Remedy:
//   rm -rf apps/worker/.wrangler/state/v3/do/do-epub-studio-worker-RateLimiterDO
//   then restart `wrangler dev` (the running worker holds the sqlite open).
// ---------------------------------------------------------------------------

const LIVE_DEMO_ENABLED = process.env.E2E_LIVE_DEMO === '1';

test.describe('Demo login against live Worker stack (GOAP-256)', () => {
  test.skip(!LIVE_DEMO_ENABLED, 'live demo stack not requested (E2E_LIVE_DEMO != 1)');

  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
  });
  // Serial: all tests share the live Worker's per-email rate limiter
  // (auth_access/auth_failures/auth_lockout DO state) and the wrong-password
  // test intentionally burns failures — parallel workers would trip the
  // 423 ACCOUNT_LOCKED lockout mid-suite.
  test.describe.configure({ mode: 'serial' });

  test('reader demo button signs in via live demo endpoint', async ({ page }) => {
    await page.goto('/login?book=demo');

    const demoButton = page.getByRole('button', { name: 'Try the demo' });
    await expect(demoButton).toBeVisible();

    await demoButton.click();

    // Live Worker mints a session for the demo book and the SPA navigates.
    await expect(page).toHaveURL(/\/read\/demo$/, { timeout: 15000 });
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
  });

  test('demo reader signs in with email + password through the live credential form', async ({
    page,
  }) => {
    await page.goto(`/login?book=${DEMO_READER.bookSlug}`);

    // "Fill demo credentials" autofills the documented demo account into the
    // form (ADR-245), then the normal /api/access/request flow authenticates
    // the seeded password hash.
    await page.getByRole('button', { name: 'Fill demo credentials' }).click();
    await expect(page.getByLabel('Email Address')).toHaveValue(DEMO_READER.email);
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue(DEMO_READER.password);

    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/read\/demo$/, { timeout: 15000 });
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
  });

  test('wrong password shows an inline error and stays on the login page', async ({ page }) => {
    await page.goto(`/login?book=${DEMO_READER.bookSlug}`);

    await page.getByLabel('Email Address').fill(DEMO_READER.email);
    await page.getByRole('textbox', { name: 'Password' }).fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Worker responds 401 ACCESS_DENIED for a wrong grant password; the form
    // surfaces it inline without navigating.
    await expect(page.getByText('Access denied', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin demo button signs in via live demo endpoint', async ({ page }) => {
    await page.goto('/admin/login');

    const demoButton = page.getByRole('button', { name: 'Try admin demo' });
    await expect(demoButton).toBeVisible();

    await demoButton.click();

    // Live Worker mints an admin session and the app routes to the admin area.
    await expect(page).toHaveURL(/\/admin\/books/, { timeout: 15000 });
  });
});
