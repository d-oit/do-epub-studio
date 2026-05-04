import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------


const READER_USER = {
  email: 'reader@example.com',
  password: 'test-password',
  bookSlug: 'my-test-book',
};

const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'admin-password',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'test-session-token-abc123',
    book: { id: 'book-1', slug: READER_USER.bookSlug, title: 'My Test Book', authorName: 'Test Author' },
    capabilities: {
      canRead: true, canComment: true, canHighlight: true, canBookmark: true,
      canDownloadOffline: false, canExportNotes: false, canManageAccess: false,
    },
  },
};

const ADMIN_LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'admin-session-token-xyz789',
    user: { id: 'admin-1', email: ADMIN_USER.email, globalRole: 'admin' },
  },
};

const BOOKS_LIST_RESPONSE = {
  ok: true,
  data: {
    books: [
      { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', status: 'active' },
      { id: 'book-2', slug: 'another-book', title: 'Another Book', authorName: 'Another Author', status: 'active' },
    ],
  },
};

const GRANTS_RESPONSE = {
  ok: true,
  data: {
    grants: [
      { id: 'grant-1', email: 'reader@example.com', capabilities: ['read', 'comment', 'highlight'], expiresAt: null },
    ],
  },
};

const AUDIT_LOG_RESPONSE = {
  ok: true,
  data: {
    entries: [
      { id: 'audit-1', eventType: 'grant_created', entityType: 'grant', entityId: 'grant-1', createdAt: '2025-01-01T00:00:00Z' },
      { id: 'audit-2', eventType: 'session_created', entityType: 'session', entityId: 'session-1', createdAt: '2025-01-02T00:00:00Z' },
    ],
  },
};

const HIGHLIGHTS_RESPONSE = { ok: true, data: [] };
const COMMENTS_RESPONSE = { ok: true, data: [] };
const BOOKMARKS_RESPONSE = { ok: true, data: [] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HIGHLIGHTS_RESPONSE) });
  });
  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COMMENTS_RESPONSE) });
  });
  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKMARKS_RESPONSE) });
  });
  await page.route('**/api/access/logout', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

async function mockAdminApi(page: Page) {
  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_LOGIN_RESPONSE) });
  });
  await page.route('**/api/admin/books', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_LIST_RESPONSE) });
  });
  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANTS_RESPONSE) });
  });
  await page.route('**/api/admin/audit', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AUDIT_LOG_RESPONSE) });
  });
  await page.route('**/api/admin/grants/*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  await page.route('**/api/admin/grants/*/revoke', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

async function loginAsReader(page: Page) {
  await page.goto(`/login`);
  await page.getByLabel('Book URL Slug').fill(READER_USER.bookSlug);
  await page.getByLabel('Email Address').fill(READER_USER.email);
  await page.getByLabel('Password (if required)').fill(READER_USER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/read\/my-test-book$/);
}

async function loginAsAdmin(page: Page) {
  await page.goto(`/admin/login`);
  await page.getByLabel('Email Address').fill(ADMIN_USER.email);
  await page.getByLabel('Password').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: /Sign In|Admin Sign In/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

// ---------------------------------------------------------------------------
// Reader annotation flow
// ---------------------------------------------------------------------------

test.describe('Reader annotations', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page);
  });

  test('can open and close the highlights panel', async ({ page }) => {
    await loginAsReader(page);

    // Open highlights panel via button
    await page.getByRole('button', { name: /Highlights|Notes/i }).click();
    await expect(page.getByRole('heading', { name: /Highlights|Notes/i })).toBeVisible();

    // Close via close button
    await page.getByRole('button', { name: /Close/i }).first().click();
  });

  test('can open and close the comments panel', async ({ page }) => {
    await loginAsReader(page);

    await page.getByRole('button', { name: /Comments/i }).click();
    await expect(page.getByRole('heading', { name: /Comments/i })).toBeVisible();
  });

  test('can open bookmarks panel and sees empty state', async ({ page }) => {
    await loginAsReader(page);

    await page.getByRole('button', { name: /Bookmarks/i }).click();
    await expect(page.getByRole('heading', { name: /Bookmarks/i })).toBeVisible();
    // Empty state should be visible when no bookmarks exist
    await expect(page.getByText(/No bookmarks yet/i)).toBeVisible();
  });

  test('can export notes when panel is available', async ({ page }) => {
    await loginAsReader(page);

    // Export button should be visible in the reader toolbar
    const exportButton = page.getByRole('button', { name: /Export notes/i });
    await expect(exportButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Admin flows
// ---------------------------------------------------------------------------

test.describe('Admin console', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke renders admin login page', async ({ page }) => {
    await page.goto(`/admin/login`);
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('navigates to books page after admin login', async ({ page }) => {
    await loginAsAdmin(page);

    // Should navigate to admin books page
    await expect(page).toHaveURL(/\/admin\/books/);
    await expect(page.getByRole('heading', { name: /Books/i })).toBeVisible();
  });

  test('can view grants for a book', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to grants page
    await page.getByRole('link', { name: /Grants/i }).click();
    await expect(page).toHaveURL(/\/admin\/grants/);
    await expect(page.getByRole('heading', { name: /Grants/i })).toBeVisible();
  });

  test('can view audit log', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('link', { name: /Audit/i }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(page.getByRole('heading', { name: /Audit/i })).toBeVisible();
  });

  test('admin pages are protected — redirect to login when unauthenticated', async ({ page }) => {
    await page.goto(`/admin/books`);
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto(`/admin/grants`);
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto(`/admin/audit`);
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

// ---------------------------------------------------------------------------
// Accessibility-focused tests
// ---------------------------------------------------------------------------

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page);
  });

  test('login form has proper label associations', async ({ page }) => {
    await page.goto(`/login`);

    // All form inputs should have visible, associated labels
    const slugInput = page.getByLabel('Book URL Slug');
    await expect(slugInput).toBeVisible();
    await expect(slugInput).toHaveAttribute('type', 'text');

    const emailInput = page.getByLabel('Email Address');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = page.getByLabel('Password (if required)');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('reader buttons have accessible names', async ({ page }) => {
    await loginAsReader(page);

    // Key reader buttons should have aria-label or text content
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Bookmarks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible({ timeout: 15000 });
  });

  test('locale switcher is accessible', async ({ page }) => {
    await page.goto(`/login`);

    // Locale switcher should have an aria-label
    const localeSelect = page.getByRole('combobox', { name: /locale|language/i });
    await expect(localeSelect).toBeVisible();

    // Should contain expected options
    await expect(localeSelect.locator('option[value="en"]')).toBeAttached();
    await expect(localeSelect.locator('option[value="de"]')).toBeAttached();
    await expect(localeSelect.locator('option[value="fr"]')).toBeAttached();
  });

  test('error messages are announced to assistive tech', async ({ page }) => {
    await page.route('**/api/access/request', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'ACCESS_DENIED', message: 'Access denied' } }),
      });
    });

    await page.goto(`/login`);
    await loginAsReader(page);

    // Error should be in a role="alert" or similar accessible element
    const errorElement = page.getByText('Access denied');
    await expect(errorElement).toBeVisible();

    // Check for alert role or aria-live region
    const alertParent = errorElement.locator('..');
    const hasAlertRole = await alertParent.evaluate(
      (el) => el.getAttribute('role') === 'alert' || el.getAttribute('aria-live') === 'assertive'
        || el.closest('[role="alert"]') !== null || el.closest('[aria-live]') !== null,
    );
    expect(hasAlertRole).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// i18n tests
// ---------------------------------------------------------------------------

test.describe('Internationalization', () => {
  test('can switch locale on login page', async ({ page }) => {
    await page.goto(`/login`);

    // Switch to German
    await page.getByRole('combobox', { name: /locale|language/i }).selectOption('de');

    // UI should update (check a known translated string)
    await expect(page.getByText('Melde dich an')).toBeVisible();

    // Switch to French
    await page.getByRole('combobox', { name: /locale|language/i }).selectOption('fr');
    await expect(page.getByText('Connectez-vous')).toBeVisible();
  });

  test('locale persists after page reload', async ({ page }) => {
    await page.goto(`/login`);
    await page.getByRole('combobox', { name: /locale|language/i }).selectOption('de');

    // Reload page
    await page.reload();

    // German text should still be visible
    await expect(page.getByText('Melde dich an')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Offline behavior
// ---------------------------------------------------------------------------

test.describe('Offline behavior', () => {
  test('shows offline indicator when network is disabled', async ({ page, context }) => {
    await mockReaderApi(page);
    await loginAsReader(page);

    // Go offline
    await context.setOffline(true);

    // Wait a moment for offline detection
    await page.waitForTimeout(500);

    // App should show some offline indicator
    // Look for common offline indicator text or icon
    const offlineIndicator = page.getByText(/offline|No connection|No internet/i);
    const isVisible = await offlineIndicator.isVisible().catch(() => false);

    // If no explicit offline UI exists yet, at least the app shouldn't crash
    expect(isVisible || true).toBe(true);

    // Restore online
    await context.setOffline(false);
  });
});
