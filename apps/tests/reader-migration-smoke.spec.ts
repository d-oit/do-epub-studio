import { test, expect } from '@playwright/test';
import { createMinimalEpub, mockReaderApi, loginAsReader } from './fixtures';

// ---------------------------------------------------------------------------
// Constants (overrides for smoke-test slug)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'smoke-test',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: process.env.TEST_SESSION_TOKEN || 'smoke-session-token',
    book: {
      id: 'book-smoke',
      slug: TEST_USER.bookSlug,
      title: 'Smoke Test Book',
      authorName: 'Test Author',
    },
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: false,
      canExportNotes: false,
      canManageAccess: false,
    },
  },
};

const EPUB_BUFFER = createMinimalEpub([
  {
    id: 'c1',
    href: 'chapter1.xhtml',
    title: 'Chapter 1',
    body: '<p>CHAPTER ONE CONTENT for the smoke test reader.</p>',
  },
  {
    id: 'c2',
    href: 'chapter2.xhtml',
    title: 'Chapter 2',
    body: '<p>CHAPTER TWO CONTENT here, different from chapter one.</p>',
  },
]);

// ---------------------------------------------------------------------------
// Smoke test suite
// ---------------------------------------------------------------------------

test.describe('Reader migration smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    await mockReaderApi(page, {
      bookSlug: TEST_USER.bookSlug,
      // Chromium blocks port 0 outright, so this must be a routable fake URL;
      // the fixture intercepts the path above.
      epubUrl: 'https://example.com/smoke-test.epub',
      epubBuffer: EPUB_BUFFER,
      loginResponse: LOGIN_RESPONSE,
    });
  });

  test('@mobile opens reader and shows book title', async ({ page }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({
      timeout: 30000,
    });
  });

  test('@mobile navigates next chapter and asserts section changed', async ({ page }) => {
    // Start from the beginning: a restored CFI is a separate concern, and the
    // keyboard walk below is deterministic only from a known location.
    await page.route('**/api/books/*/progress', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { locator: { cfi: null }, progressPercent: 0 } }),
      });
    });
    await loginAsReader(page, TEST_USER.bookSlug);

    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Get initial chapter content
    function getBodyText() {
      return page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        if (!iframe?.contentDocument?.body) return null;
        return iframe.contentDocument.body.textContent ?? null;
      });
    }

    const initialText = await getBodyText();
    expect(initialText).toContain('CHAPTER ONE CONTENT');

    await page.keyboard.press('ArrowRight');
    await expect.poll(getBodyText, { timeout: 10000 }).toContain('CHAPTER TWO CONTENT');

    await page.keyboard.press('ArrowLeft');
    await expect.poll(getBodyText, { timeout: 10000 }).toContain('CHAPTER ONE CONTENT');
  });
  test('@mobile @smoke navigates to a TOC chapter and restores its location after reload', async ({
    page,
  }) => {
    // The CFI persisted for the *Chapter 2* position. The reader also PUTs
    // the Chapter 1 position, so tracking "the last CFI seen" would happily
    // accept that earlier write and reload the reader into Chapter 1 — a
    // green test that proves nothing. The Chapter 2 position is identified
    // by its spine CFI: the second spine item is `/6/4`, the first is
    // `/6/2`, so the CFI whose spine step is `4` is the chapter the TOC
    // navigation reached.
    const CHAPTER2_SPINE_STEP = '/6/4';
    let chapter2Cfi: string | null = null;
    let restoredCfi: string | null = null;

    await page.route('**/api/books/*/progress', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        const cfi = chapter2Cfi;
        if (cfi) restoredCfi = cfi;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              locator: { cfi },
              progressPercent: 0,
              updatedAt: '2026-01-01T00:00:00.000Z',
              revision: 1,
            },
          }),
        });
        return;
      }

      if (method === 'PUT') {
        const body = route.request().postDataJSON() as { locator?: { cfi?: unknown } };
        if (
          typeof body.locator?.cfi === 'string' &&
          body.locator.cfi.includes(CHAPTER2_SPINE_STEP)
        ) {
          chapter2Cfi = body.locator.cfi;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { revision: 2, updatedAt: '2026-01-01T00:00:01.000Z' },
          }),
        });
        return;
      }

      // `fallback()` hands the request to the previously registered handler
      // (the shared `mockReaderApi` progress route) instead of continuing to
      // the network. A plain `continue()` here would let the request escape
      // to the real API.
      await route.fallback();
    });

    await loginAsReader(page, TEST_USER.bookSlug);
    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({
      timeout: 30000,
    });

    // Read the chapter text out of the sandboxed book frame. The element
    // handle is typed as `HTMLElement | SVGElement`, which has no
    // `contentDocument`; querying inside `page.evaluate` gives the real
    // `HTMLIFrameElement`.
    function getBodyText() {
      return page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        if (!iframe?.contentDocument?.body) return null;
        return iframe.contentDocument.body.textContent ?? null;
      });
    }
    await expect.poll(getBodyText, { timeout: 10000 }).toContain('CHAPTER ONE CONTENT');

    await page.getByRole('button', { name: 'Contents' }).click();
    await page
      .getByRole('dialog', { name: 'Contents' })
      .getByRole('button', { name: 'Chapter 2' })
      .click();

    await expect.poll(getBodyText, { timeout: 10000 }).toContain('CHAPTER TWO CONTENT');
    // Wait for the *Chapter 2* progress write, not merely for some write.
    // Reloading before this write lands would restore Chapter 1, and the
    // assertions below would then pass for the wrong reason — or fail
    // intermittently, depending on which write the debounce flushed.
    await expect.poll(() => chapter2Cfi, { timeout: 10000 }).not.toBeNull();
    expect(chapter2Cfi).toMatch(/^epubcfi\(/);

    const expectedCfi = chapter2Cfi;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({
      timeout: 30000,
    });
    await expect.poll(() => restoredCfi, { timeout: 10000 }).toBe(expectedCfi);
    await expect.poll(getBodyText, { timeout: 10000 }).toContain('CHAPTER TWO CONTENT');
    await expect(page).toHaveURL(/\/read\/smoke-test$/);
  });
});
