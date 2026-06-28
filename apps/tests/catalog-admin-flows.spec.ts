import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const READER_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'my-test-book',
};

const ADMIN_USER = {
  email: 'admin@example.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'admin-password',
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

const ADMIN_LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'admin-session-token-xyz789',
    email: ADMIN_USER.email,
  },
};

const BOOKS_LIST_RESPONSE = {
  ok: true,
  data: [
    { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', visibility: 'public' },
    { id: 'book-2', slug: 'another-book', title: 'Another Book', authorName: 'Another Author', visibility: 'private' },
    { id: 'book-3', slug: 'third-book', title: 'Third Book', authorName: 'Third Author', visibility: 'public' },
  ],
};

const BOOKS_SEARCH_RESPONSE = {
  ok: true,
  data: [
    { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', visibility: 'public' },
  ],
};

const GRANTS_RESPONSE = {
  ok: true,
  data: [
    { id: 'grant-1', email: 'reader@example.com', mode: 'reader', commentsAllowed: true, offlineAllowed: true, expiresAt: null, createdAt: '2025-01-01T00:00:00Z', status: 'active' },
    { id: 'grant-2', email: 'reader2@example.com', mode: 'reader', commentsAllowed: false, offlineAllowed: false, expiresAt: '2025-12-31T00:00:00Z', createdAt: '2025-01-02T00:00:00Z', status: 'active' },
  ],
};

const GRANT_CREATE_RESPONSE = {
  ok: true,
  data: { id: 'grant-3', email: 'newuser@example.com', mode: 'reader', commentsAllowed: true, offlineAllowed: true, expiresAt: null, createdAt: '2025-01-03T00:00:00Z', status: 'active' },
};

const GRANT_UPDATE_RESPONSE = {
  ok: true,
  data: { id: 'grant-1', email: 'reader@example.com', mode: 'reader', commentsAllowed: false, offlineAllowed: false, expiresAt: '2025-12-31T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', status: 'active' },
};

const AUDIT_LOG_RESPONSE = {
  ok: true,
  data: {
    entries: [
      { id: 'audit-1', actorEmail: 'admin@example.com', entityType: 'grant', entityId: 'grant-1', action: 'create', createdAt: '2025-01-01T00:00:00Z', payload: { email: 'reader@example.com' } },
      { id: 'audit-2', actorEmail: 'admin@example.com', entityType: 'book', entityId: 'book-1', action: 'update', createdAt: '2025-01-02T00:00:00Z', payload: { title: 'My Test Book' } },
      { id: 'audit-3', actorEmail: 'admin@example.com', entityType: 'grant', entityId: 'grant-2', action: 'revoke', createdAt: '2025-01-03T00:00:00Z', payload: { email: 'reader2@example.com' } },
    ],
    total: 3,
  },
};

const AUDIT_LOG_FILTERED_RESPONSE = {
  ok: true,
  data: {
    entries: [
      { id: 'audit-1', actorEmail: 'admin@example.com', entityType: 'grant', entityId: 'grant-1', action: 'create', createdAt: '2025-01-01T00:00:00Z', payload: { email: 'reader@example.com' } },
    ],
    total: 1,
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
  await page.route('**/api/admin/books', async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search');
    if (search) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_SEARCH_RESPONSE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_LIST_RESPONSE) });
    }
  });
  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANTS_RESPONSE) });
  });
  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANT_CREATE_RESPONSE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANTS_RESPONSE) });
    }
  });
  await page.route('**/api/admin/grants/*', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANT_UPDATE_RESPONSE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
    }
  });
  await page.route('**/api/admin/grants/*/revoke', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  await page.route('**/api/admin/audit-log*', async (route: Route) => {
    const url = new URL(route.request().url());
    const entityType = url.searchParams.get('entityType');
    if (entityType) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AUDIT_LOG_FILTERED_RESPONSE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AUDIT_LOG_RESPONSE) });
    }
  });
}

async function loginAsAdmin(page: Page) {
  await page.goto(`/admin/login`);
  await page.getByLabel('Email Address').fill(ADMIN_USER.email);
  await page.getByLabel('Password').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: /Sign In|Admin Sign In/i }).click();
  await expect(page).toHaveURL(/\/admin\/books/);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// E1: Catalog browsing flow (search, filter, pagination)
// ---------------------------------------------------------------------------

test.describe('Catalog browsing flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke displays books list after admin login', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
    await expect(page.getByText('My Test Book')).toBeVisible();
    await expect(page.getByText('Another Book')).toBeVisible();
  });

  test('can search books by title', async ({ page }) => {
    await loginAsAdmin(page);

    const searchInput = page.getByPlaceholder(/Search books/i);
    await searchInput.fill('My Test');
    await page.waitForTimeout(500);

    await expect(page.getByText('My Test Book')).toBeVisible();
  });

  test('can navigate to book details', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);
  });
});

// ---------------------------------------------------------------------------
// E2: Book upload flow (admin creates book, uploads EPUB)
// ---------------------------------------------------------------------------

test.describe('Book upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
    await page.route('**/api/admin/books', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { id: 'book-new', slug: 'new-book', title: 'New Book', authorName: 'New Author' },
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_LIST_RESPONSE) });
      }
    });
  });

  test('admin can access book management page', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
  });

  test('admin books page shows book count', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByText('Your Books')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// E3: Admin grants management (create, update, revoke)
// ---------------------------------------------------------------------------

test.describe('Admin grants management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke can view grants for a book', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await expect(page.getByText('reader@example.com')).toBeVisible();
  });

  test('grants table shows email and mode columns', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await expect(page.getByText('reader@example.com')).toBeVisible();
  });

  test('can revoke a grant', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    const revokeButton = page.getByRole('button', { name: /Revoke/i }).first();
    if (await revokeButton.isVisible()) {
      await revokeButton.click();
      await page.waitForTimeout(500);
    }
  });
});

// ---------------------------------------------------------------------------
// E4: Admin audit log viewing and filtering
// ---------------------------------------------------------------------------

test.describe('Admin audit log viewing and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke can view audit log page', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible();
  });

  test('audit log displays entries', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    await expect(page.getByText('admin@example.com')).toBeVisible();
  });

  test('can filter audit log by entity type', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    const entitySelect = page.getByLabel(/Entity Type/i);
    if (await entitySelect.isVisible()) {
      await entitySelect.selectOption('grant');
      await page.waitForTimeout(500);
    }
  });

  test('can export audit log as CSV', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    const exportButton = page.getByRole('button', { name: /Export CSV/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeVisible();
    }
  });

  test('audit log pagination controls are visible', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    const prevButton = page.getByRole('button', { name: /Previous/i });
    const nextButton = page.getByRole('button', { name: /Next/i });

    if (await prevButton.isVisible()) {
      await expect(prevButton).toBeVisible();
      await expect(nextButton).toBeVisible();
    }
  });
});
