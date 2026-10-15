import { test, expect, type Page } from '@playwright/test';
import {
  createMinimalEpub,
  loginAsReader,
  mockReaderApi,
  selectReaderPassage,
  suppressWorkboxErrors,
  waitForServiceWorkerActivation,
} from './fixtures';

// ---------------------------------------------------------------------------
// Constants (offline-specific overrides)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'offline-test',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'offline-session-token',
    book: {
      id: 'book-offline',
      slug: TEST_USER.bookSlug,
      title: 'Offline Test Book',
      authorName: 'Test Author',
    },
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: true,
      canExportNotes: false,
      canManageAccess: false,
    },
  },
};

const EPUB_BUFFER = createMinimalEpub(
  [
    {
      id: 'c1',
      href: 'chapter1.xhtml',
      title: 'Chapter 1',
      body: '<p>OFFLINE TEST CONTENT for the offline reader test.</p>',
    },
  ],
  { title: 'Offline Test Book', identifier: 'urn:uuid:offline-test-book' },
);

const EPUB_URL = '/api/files/offline-test.epub';

function resolveEpubUrl(baseURL: string | URL | undefined): string {
  if (!baseURL) throw new Error('Playwright project baseURL is required');
  return new URL(EPUB_URL, baseURL).toString();
}

/** Visible text of the rendered epub.js chapter iframe (null before rendition). */
async function getChapterText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe?.contentDocument?.body?.textContent ?? null;
  });
}

async function createOfflineComment(page: Page, body: string): Promise<void> {
  await selectReaderPassage(page, 'OFFLINE TEST CONTENT');
  await page
    .locator('button')
    .filter({ hasText: /^Comment$/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Comment' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(body);
  await dialog.getByRole('button', { name: 'Comment' }).click();
  await expect(dialog).not.toBeVisible();
}

async function openCommentsPanel(page: Page) {
  const commentsButton = page.getByRole('button', { name: /^Comments/ });
  await commentsButton.focus();
  await commentsButton.press('Enter');
  return page.locator('aside');
}

// ---------------------------------------------------------------------------
// Offline reader test suite
// ---------------------------------------------------------------------------

test.describe('Offline reader', () => {
  test.beforeEach(async ({ page, context }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(context, {
      bookSlug: TEST_USER.bookSlug,
      epubUrl: EPUB_URL,
      epubBuffer: EPUB_BUFFER,
      loginResponse: LOGIN_RESPONSE,
    });
  });

  test('@mobile @pwa offline reload renders the cached chapter and survives reconnect', async ({
    page,
    context,
  }, testInfo) => {
    const epubUrl = resolveEpubUrl(testInfo.project.use.baseURL);
    await loginAsReader(page, TEST_USER.bookSlug);

    // Online, uncontrolled load: the fixture renders and the signed file URL
    // is cached in the (encrypted) offline DB for the fallback below.
    await expect
      .poll(() => getChapterText(page), { timeout: 30_000 })
      .toContain('OFFLINE TEST CONTENT');

    await waitForServiceWorkerActivation(page);

    // Acquire service-worker control: registerType 'prompt' means only pages
    // loaded after activation are controlled (same pattern as the cached-API
    // test above). This controlled online reload is a boot step, not an
    // assertion target — page.route mocks are bypassed under SW control.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            try {
              await navigator.serviceWorker.ready;
            } catch {
              return false;
            }
            return Boolean(navigator.serviceWorker.controller);
          }),
        { timeout: 15_000, message: 'Service Worker must control the page in pwa-chromium' },
      )
      .toBe(true);
    await expect
      .poll(() => getChapterText(page), {
        timeout: 30_000,
        message: 'Controlled reload must finish loading the EPUB before checking Workbox',
      })
      .toContain('OFFLINE TEST CONTENT');

    // The controlled online reader load above must populate the Workbox cache
    // through its normal book-file request before the offline reload.
    await expect
      .poll(
        () =>
          page.evaluate(async (url) => {
            const cache = await caches.open('book-content');
            return Boolean(await cache.match(url));
          }, epubUrl),
        {
          timeout: 15_000,
          message: 'Online reader load should populate the Workbox EPUB cache',
        },
      )
      .toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // The file-url POST cannot succeed offline; the reader must fall back to
    // the cached URL and the SW must serve the cached bytes. A body-only error
    // document fails here.
    await expect
      .poll(() => getChapterText(page), { timeout: 30_000 })
      .toContain('OFFLINE TEST CONTENT');
    await expect(page.getByText(/Failed to load book/)).toHaveCount(0);

    // Reader controls work offline. Keyboard activation is used because the
    // "You are offline" banner (role=alert) sits over the toolbar while
    // offline; pointer interception must not be the thing under test.
    const contentsButton = page.getByRole('button', { name: 'Contents' });
    await contentsButton.focus();
    await contentsButton.press('Enter');
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    await context.setOffline(false);

    // Reconnect does not lose state: the rendered chapter survives and the
    // cached file row remains available for the next offline load.
    await expect
      .poll(() => getChapterText(page), { timeout: 15_000 })
      .toContain('OFFLINE TEST CONTENT');
  });

  test('@mobile @pwa detects offline/online status transitions', async ({ page, context }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    const initialOnline = await page.evaluate(() => navigator.onLine);
    expect(initialOnline).toBe(true);

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    const bodyOk = await page
      .locator('body')
      .isVisible()
      .catch(() => false);
    expect(bodyOk).toBe(true);

    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  });

  test('@mobile @pwa serves cached API responses while offline (NetworkFirst strategy)', async ({
    page,
    context,
  }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await waitForServiceWorkerActivation(page);

    // The worker uses registerType 'prompt' (no clients.claim: update control
    // stays with the user), so only pages loaded after SW activation are
    // controlled. Reload before asserting control — if the SW still does not
    // control the page after reload, the hard assert below fails loudly
    // (E2E-02: never silently skip missing SW control).
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            try {
              await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
              ]);
              return Boolean(navigator.serviceWorker.controller);
            } catch {
              return false;
            }
          }),
        {
          timeout: 15_000,
          message: 'Service Worker must be active and controlling the page in pwa-chromium',
        },
      )
      .toBe(true);
    // Seed the strategy cache directly. With a controlling SW, page.route
    // mocks are bypassed (the SW fetches from its own context, invisible to
    // Playwright routing), so seed the real 'api-responses' cache that the
    // NetworkFirst route in sw.ts reads.
    await page.evaluate(async () => {
      const cache = await caches.open('api-responses');
      await cache.put(
        '/api/books/offline-test-cached',
        new Response(JSON.stringify({ ok: true, data: { value: 'cached-offline-data' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    const cachedResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/books/offline-test-cached');
        const data = (await res.json()) as { data?: { value?: string } };
        return { ok: true, value: data.data?.value ?? null };
      } catch {
        return { ok: false, value: null };
      }
    });

    expect(cachedResult.ok).toBe(true);
    expect(cachedResult.value).toBe('cached-offline-data');

    const inCache = await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        const cache = await caches.open(key);
        const match = await cache.match('/api/books/offline-test-cached');
        if (match) return true;
      }
      return false;
    });
    expect(inCache).toBe(true);

    await context.setOffline(false);
  });

  test('@mobile @pwa queues offline actions for sync when network is unavailable', async ({
    page,
    context,
  }) => {
    let offline = false;
    await page.route('**/api/books/*/comments', async (route) => {
      if (offline) {
        await route.abort('internetdisconnected');
        return;
      }
      await route.fallback();
    });

    await loginAsReader(page, TEST_USER.bookSlug);
    await context.setOffline(true);
    offline = true;

    const body = 'Offline comment remains pending';
    await createOfflineComment(page, body);
    const panel = await openCommentsPanel(page);

    await expect(panel.getByText(body)).toBeVisible();
    await expect(panel.getByRole('status')).toContainText('Pending sync');
  });

  test('@mobile @pwa flushes sync queue after reconnection', async ({ page, context }) => {
    let offline = false;
    const syncedComments: Array<{
      id: string;
      displayName: string;
      isOwn: boolean;
      chapterRef: string | null;
      cfiRange: string | null;
      selectedText: string | null;
      body: string;
      status: string;
      visibility: string;
      parentCommentId: string | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt: string | null;
    }> = [];
    const syncedBodies: string[] = [];
    await page.route('**/api/books/*/comments', async (route) => {
      if (offline) {
        await route.abort('internetdisconnected');
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: syncedComments }),
        });
        return;
      }
      if (route.request().method() === 'POST') {
        const request = route.request().postDataJSON() as { body?: string };
        const now = new Date().toISOString();
        const comment = {
          id: `synced-comment-${syncedComments.length + 1}`,
          displayName: 'reader',
          isOwn: true,
          chapterRef: 'chapter1.xhtml',
          cfiRange: 'epubcfi(/6/4)',
          selectedText: 'OFFLINE TEST CONTENT',
          body: request.body ?? '',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          createdAt: now,
          updatedAt: now,
          resolvedAt: null,
        };
        syncedComments.push(comment);
        syncedBodies.push(comment.body);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: comment }),
        });
        return;
      }
      await route.fallback();
    });

    await loginAsReader(page, TEST_USER.bookSlug);
    await context.setOffline(true);
    offline = true;

    const body = 'Comment sent after reconnect';
    await createOfflineComment(page, body);
    const panel = await openCommentsPanel(page);
    await expect(panel.getByRole('status')).toContainText('Pending sync');

    offline = false;
    await context.setOffline(false);
    await expect
      .poll(() => syncedBodies, {
        timeout: 20_000,
        message: 'Queued comment should reach the API after reconnection',
      })
      .toContain(body);
    await expect(panel.getByRole('status')).toHaveCount(0, { timeout: 20_000 });
    await expect(panel.getByText(body)).toBeVisible();
  });
});
