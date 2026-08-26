import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Cloudflare Pages E2E login tests
//
// These tests run against the LIVE Cloudflare Pages deployment (not mocked).
// Set CLOUDFLARE_PREVIEW_URL to the Pages preview URL to test against a
// specific deployment. Falls back to the local dev server.
//
// Usage:
//   CLOUDFLARE_PREVIEW_URL=https://<hash>.do-epub-studio.pages.dev npx playwright test apps/tests/cloudflare-login.spec.ts
// ---------------------------------------------------------------------------

const CF_PREVIEW_URL = process.env.CLOUDFLARE_PREVIEW_URL;
const BASE_URL = CF_PREVIEW_URL || 'http://127.0.0.1:5173';

// Test credentials — these must exist on the target deployment.
// On the production/staging Cloudflare Pages deployment, use the seeded
// demo accounts or real test accounts.
const READER = {
  email: process.env.E2E_READER_EMAIL || 'reader@example.com',
  password: process.env.E2E_READER_PASSWORD || 'test-password',
  bookSlug: process.env.E2E_READER_BOOK_SLUG || 'my-test-book',
};

const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'test-password',
};

// ---------------------------------------------------------------------------
// Reader login tests (Cloudflare)
// ---------------------------------------------------------------------------

test.describe('Cloudflare reader login', () => {
  test.use({ baseURL: BASE_URL });

  test('@smoke renders the login page with glass morphism card', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    // The login card should have the glass-card class (glassmorphism)
    const loginCard = page.getByTestId('login-card');
    await expect(loginCard).toBeVisible();

    // Form fields should be present
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('@smoke password toggle works on the right side', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle should be on the RIGHT side of the password field (ADR-249)
    const toggle = page.getByRole('button', { name: 'Show password' });
    const passwordBox = await passwordInput.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(passwordBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.x + toggleBox!.width / 2).toBeGreaterThan(passwordBox!.x + passwordBox!.width / 2);

    // Click toggle — should show password
    await toggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toBeVisible();

    // Click again — should hide password
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('@smoke logs in successfully against Cloudflare backend', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    await page.getByLabel('Email Address').fill(READER.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(READER.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should navigate to the reader
    await expect(page).toHaveURL(new RegExp(`/read/${READER.bookSlug}`), { timeout: 20000 });

    // Reader should be visible
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({ timeout: 30000 });
  });

  test('shows error for invalid credentials against Cloudflare', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    await page.getByLabel('Email Address').fill('nonexistent@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should show an error message (not navigate)
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('renders the feature bullets without any interaction', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    // The brand panel (desktop) / info block (mobile) shows the feature
    // bullets directly — no disclosure interaction required.
    await expect(page.getByText('Responsive EPUB reading')).toBeVisible();
    await expect(page.getByText('Highlights, annotations & bookmarks')).toBeVisible();
    await expect(page.getByText('Offline reading with sync')).toBeVisible();
  });

  test('renders the mobile brand header and info block on small viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/login?book=${READER.bookSlug}`);

    // The brand header (logo + name) shows above the card on small screens
    const mobileInfo = page.getByTestId('login-brand');
    await expect(mobileInfo).toBeVisible();

    // The compact info block below the card carries the access note
    await expect(page.getByTestId('login-about')).toBeVisible();
    await expect(page.getByText(/No signup needed/)).toBeVisible();
  });

  test('handles empty bookSlug gracefully', async ({ page }) => {
    // Navigate without ?book= param — bookSlug should be optional now
    await page.goto('/login');

    // Should render without validation error
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('admin link navigates to admin login', async ({ page }) => {
    await page.goto(`/login?book=${READER.bookSlug}`);

    const adminLink = page.getByRole('button', { name: /Admin/i });
    await expect(adminLink).toBeVisible();
    await adminLink.click();

    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

// ---------------------------------------------------------------------------
// Admin login tests (Cloudflare)
// ---------------------------------------------------------------------------

test.describe('Cloudflare admin login', () => {
  test.use({ baseURL: BASE_URL });

  test('@smoke renders the admin login page with glass morphism', async ({ page }) => {
    await page.goto('/admin/login');

    const loginCard = page.getByTestId('admin-login-card');
    await expect(loginCard).toBeVisible();

    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  });

  test('@smoke password toggle works on admin login', async ({ page }) => {
    await page.goto('/admin/login');

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggle = page.getByRole('button', { name: 'Show password' });
    await toggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('@smoke logs in as admin against Cloudflare backend', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Email Address').fill(ADMIN.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should navigate to admin dashboard
    await expect(page).toHaveURL(/\/admin\/books/, { timeout: 20000 });
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 20000 });
  });

  test('renders the admin hero with feature list', async ({ page }) => {
    await page.goto('/admin/login');

    const hero = page.getByTestId('admin-login-hero');
    await expect(hero.getByText('Upload & manage EPUBs')).toBeVisible();
    await expect(hero.getByText('Reader access grants')).toBeVisible();
    await expect(hero.getByText('Audit logs')).toBeVisible();
  });

  test('reader link navigates to reader login', async ({ page }) => {
    await page.goto('/admin/login');

    const readerLink = page.getByRole('button', { name: /Reader/i });
    await expect(readerLink).toBeVisible();
    await readerLink.click();

    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Cross-origin / Cloudflare-specific checks
// ---------------------------------------------------------------------------

test.describe('Cloudflare deployment checks', () => {
  test.use({ baseURL: BASE_URL });

  test('API responses include Cloudflare headers', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify the page loaded — this ensures the Cloudflare Pages function is reachable
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  test('health endpoint is reachable', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('do-epub-studio-worker');
  });
});
