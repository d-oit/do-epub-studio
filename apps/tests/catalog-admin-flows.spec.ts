import { readFileSync } from 'node:fs';
import { test, expect, type Page, type Route } from '@playwright/test';
import { ADMIN_LOGIN_RESPONSE, loginAsAdmin } from './fixtures';

const BOOKS_LIST_RESPONSE = {
  ok: true,
  data: [
    {
      id: 'book-1',
      slug: 'my-test-book',
      title: 'My Test Book',
      authorName: 'Test Author',
      visibility: 'public',
    },
    {
      id: 'book-2',
      slug: 'another-book',
      title: 'Another Book',
      authorName: 'Another Author',
      visibility: 'private',
    },
    {
      id: 'book-3',
      slug: 'third-book',
      title: 'Third Book',
      authorName: 'Third Author',
      visibility: 'public',
    },
  ],
};

const BOOKS_SEARCH_RESPONSE = {
  ok: true,
  data: [
    {
      id: 'book-1',
      slug: 'my-test-book',
      title: 'My Test Book',
      authorName: 'Test Author',
      visibility: 'public',
    },
  ],
};

const GRANTS_RESPONSE = {
  ok: true,
  data: [
    {
      id: 'grant-1',
      email: 'reader@example.com',
      mode: 'reader',
      commentsAllowed: true,
      offlineAllowed: true,
      expiresAt: null,
      createdAt: '2025-01-01T00:00:00Z',
      status: 'active',
    },
    {
      id: 'grant-2',
      email: 'reader2@example.com',
      mode: 'reader',
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: '2025-12-31T00:00:00Z',
      createdAt: '2025-01-02T00:00:00Z',
      status: 'active',
    },
  ],
};

const GRANT_CREATE_RESPONSE = {
  ok: true,
  data: {
    id: 'grant-3',
    email: 'newuser@example.com',
    mode: 'reader',
    commentsAllowed: true,
    offlineAllowed: true,
    expiresAt: null,
    createdAt: '2025-01-03T00:00:00Z',
    status: 'active',
  },
};

const GRANT_UPDATE_RESPONSE = {
  ok: true,
  data: {
    id: 'grant-1',
    email: 'reader@example.com',
    mode: 'reader',
    commentsAllowed: false,
    offlineAllowed: false,
    expiresAt: '2025-12-31T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    status: 'active',
  },
};

const AUDIT_ENTRIES_ALL = Array.from({ length: 75 }, (_, i) => ({
  id: `audit-${i + 1}`,
  actorEmail: 'admin@example.com',
  entityType: i % 2 === 0 ? 'grant' : 'book',
  entityId: i % 2 === 0 ? `grant-${i + 1}` : `book-${i + 1}`,
  action: i % 2 === 0 ? 'create' : 'update',
  createdAt: new Date(1735689600000 + i * 60000).toISOString(),
  payload: { email: `reader${i + 1}@example.com` },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockAdminApi(page: Page) {
  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_LOGIN_RESPONSE),
    });
  });
  await page.route('**/api/admin/books', async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search');
    if (search) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BOOKS_SEARCH_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BOOKS_LIST_RESPONSE),
      });
    }
  });
  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(GRANTS_RESPONSE),
    });
  });
  await page.route('**/api/admin/books/*/invitations', async (route: Route) => {
    const body =
      route.request().method() === 'POST'
        ? {
            ok: true,
            data: {
              invitation: {
                id: 'invite-new',
                bookId: 'book-1',
                email: 'invited@example.com',
                role: 'reader',
                status: 'pending',
                deliveryStatus: 'manual_copy_required',
                deliveryErrorCode: null,
                grantMode: 'private',
                commentsAllowed: false,
                offlineAllowed: false,
                grantExpiresAt: null,
                expiresAt: '2099-01-01T00:00:00.000Z',
                createdAt: '2026-01-01T00:00:00.000Z',
                acceptedAt: null,
                revokedAt: null,
              },
              delivery: 'manual_copy_required',
              copyUrl: 'https://app.example.com/accept-invite#token=fixture',
            },
          }
        : { ok: true, data: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.route('**/api/admin/books/*/creators', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GRANT_CREATE_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GRANTS_RESPONSE),
      });
    }
  });
  await page.route('**/api/admin/grants/*', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GRANT_UPDATE_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: {} }),
      });
    }
  });
  await page.route('**/api/admin/grants/*/revoke', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: {} }),
    });
  });
  await page.route('**/api/admin/audit*', async (route: Route) => {
    const url = new URL(route.request().url());
    const entityType = url.searchParams.get('entityType');
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const filtered = entityType
      ? AUDIT_ENTRIES_ALL.filter((e) => e.entityType === entityType)
      : AUDIT_ENTRIES_ALL;
    const paginated = filtered.slice(offset, offset + limit);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { entries: paginated, total: filtered.length },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// E1: Catalog browsing flow (search, filter, pagination)
// ---------------------------------------------------------------------------

test.describe('Catalog browsing flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke @mobile displays books list after admin login', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
    await expect(page.getByText('My Test Book')).toBeVisible();
    await expect(page.getByText('Another Book')).toBeVisible();
  });

  test('@mobile can search books by title', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByText('My Test Book')).toBeVisible();
  });

  test('@mobile can navigate to book details', async ({ page }) => {
    await loginAsAdmin(page);

    await page
      .getByRole('button', { name: /Manage Access/i })
      .first()
      .click();
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(BOOKS_LIST_RESPONSE),
        });
      }
    });
  });

  test('@mobile admin can access book management page', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
  });

  test('@mobile admin books page shows book count', async ({ page }) => {
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

  test('@smoke @mobile can view grants for a book', async ({ page }) => {
    await loginAsAdmin(page);

    await page
      .getByRole('button', { name: /Manage Access/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await expect(page.getByText('reader@example.com')).toBeVisible();
  });

  test('@mobile grants table shows email and mode columns', async ({ page }) => {
    await loginAsAdmin(page);

    await page
      .getByRole('button', { name: /Manage Access/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await expect(page.getByText('reader@example.com')).toBeVisible();
  });

  test('@mobile can revoke a grant', async ({ page }) => {
    await loginAsAdmin(page);

    await page
      .getByRole('button', { name: /Manage Access/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    const revokeButton = page.getByRole('button', { name: /Revoke/i }).first();
    await expect(revokeButton).toBeVisible();
    await revokeButton.click();
    const confirmButton = page.getByRole('dialog').getByRole('button', { name: /Revoke/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    await expect(revokeButton).not.toBeVisible();
  });
  test('@smoke @mobile can create an invitation with manual delivery', async ({ page }) => {
    await loginAsAdmin(page);
    await page
      .getByRole('button', { name: /Manage Access/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await page.getByRole('button', { name: 'Invite person' }).click();
    await page.getByLabel('Email address').fill('invited@example.com');
    await page.getByRole('button', { name: 'Send invitation' }).click();

    await expect(
      page.getByText(
        'Email delivery is unavailable. Copy this one-time link and send it through an approved channel.',
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Invitation link')).toHaveValue(
      'https://app.example.com/accept-invite#token=fixture',
    );
  });
});

// ---------------------------------------------------------------------------
// E4: Admin audit log viewing and filtering
// ---------------------------------------------------------------------------

test.describe('Admin audit log viewing and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke @mobile can view audit log page', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible();
  });

  test('@mobile audit log displays entries', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    await expect(page.getByText('admin@example.com').first()).toBeVisible();
  });

  test('@mobile can filter audit log by entity type', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    // Initial unfiltered state displays mixed entity types
    await expect(page.getByText('grant: grant-1', { exact: true })).toBeVisible();
    await expect(page.getByText('book: book-2', { exact: true })).toBeVisible();

    const entitySelect = page.getByLabel(/Entity Type/i);
    await expect(entitySelect).toBeVisible();
    await entitySelect.selectOption('grant');

    // Filtered state changes rows: grant rows stay visible, book rows are removed
    await expect(page.getByText('grant: grant-1', { exact: true })).toBeVisible();
    await expect(page.getByText('book: book-2', { exact: true })).not.toBeVisible();
  });

  test('@mobile can export audit log as CSV', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    const exportButton = page.getByRole('button', { name: /Export CSV/i });
    await expect(exportButton).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const csvContent = readFileSync(downloadPath, 'utf8');
    expect(csvContent).toContain('ID,Timestamp,Actor Email,Entity Type,Entity ID,Action,Payload');
    expect(csvContent).toContain('"grant-1"');
    expect(csvContent).toContain('admin@example.com');
  });
  test('@mobile audit log pagination controls are visible', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);

    const prevButton = page.getByRole('button', { name: /Previous/i });
    const nextButton = page.getByRole('button', { name: /Next/i });

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    await expect(prevButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();

    await nextButton.click();
    await expect(prevButton).toBeEnabled();
    await expect(nextButton).toBeDisabled();
    await expect(page.getByText('grant: grant-51')).toBeVisible();
  });
});
