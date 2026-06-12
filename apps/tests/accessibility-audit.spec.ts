import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Fixtures & mocks
// ---------------------------------------------------------------------------


const READER_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'my-test-book',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: process.env.TEST_SESSION_TOKEN || 'test-session-token-abc123',
    book: { id: 'book-1', slug: READER_USER.bookSlug, title: 'My Test Book', authorName: 'Test Author' },
    capabilities: {
      canRead: true, canComment: true, canHighlight: true, canBookmark: true,
      canDownloadOffline: false, canExportNotes: false, canManageAccess: false,
    },
  },
};

async function mockReaderApi(page: Page) {
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) });
  });
  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: 'https://example.com/test.epub' } }) });
  });
  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0.1 } }) });
  });
  await page.route('**/api/books/*/highlights', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/access/logout', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

// ---------------------------------------------------------------------------
// Axe-core accessibility audit tests
// ---------------------------------------------------------------------------

test.describe('Accessibility audit (axe-core)', () => {
  test('login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/login`);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    // Critical violations must be zero
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);

    // No moderate violations either for core pages
    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('reader page has no critical accessibility violations', async ({ page }) => {
    await mockReaderApi(page);

    // Login
    await page.goto(`/login?book=${READER_USER.bookSlug}`);
    await page.getByLabel('Email Address').fill(READER_USER.email);
    await page.getByLabel('Password').fill(READER_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(new RegExp(`/read/${READER_USER.bookSlug}$`));

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('reader settings panel has no accessibility violations', async ({ page }) => {
    await mockReaderApi(page);
    await page.goto(`/login?book=${READER_USER.bookSlug}`);
    await page.getByLabel('Email Address').fill(READER_USER.email);
    await page.getByLabel('Password').fill(READER_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(new RegExp(`/read/${READER_USER.bookSlug}$`));

    await page.getByLabel('Settings').first().click();
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('reader TOC panel has no accessibility violations', async ({ page }) => {
    await mockReaderApi(page);
    await page.goto(`/login?book=${READER_USER.bookSlug}`);
    await page.getByLabel('Email Address').fill(READER_USER.email);
    await page.getByLabel('Password').fill(READER_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('keyboard navigation: can close panels with Escape', async ({ page }) => {
    await mockReaderApi(page);
    await page.goto(`/login?book=${READER_USER.bookSlug}`);
    await page.getByLabel('Email Address').fill(READER_USER.email);
    await page.getByLabel('Password').fill(READER_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Open Settings
    await page.getByLabel('Settings').first().click();
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).not.toBeVisible();

    // Open TOC
    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();
  });

  test('admin login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/admin/login`);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Admin pages (C2 — axe-core audits for admin pages)
  // -------------------------------------------------------------------------

  async function mockAdminApi(page: Page) {
    await page.route('**/api/admin/login', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { sessionToken: 'admin-test-token', email: 'admin@example.com' },
        }),
      });
    });
    await page.route('**/api/admin/books', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
    await page.route('**/api/admin/grants**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
    await page.route('**/api/admin/audit**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { entries: [], total: 0 } }),
      });
    });
  }

  async function loginAsAdmin(page: Page) {
    await page.goto('/admin/login');
    await page.getByLabel('Email Address').fill('admin@example.com');
    await page.getByLabel('Password').fill('admin-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/books/);
  }

  test('admin books list page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin books):', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('admin grants page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/grants');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin grants):', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('admin audit log page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/audit');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin audit):', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });
});
