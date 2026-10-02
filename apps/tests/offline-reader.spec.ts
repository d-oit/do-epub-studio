import { test, expect, type Page, type Route } from '@playwright/test';
import { createMinimalEpub, mockReaderApi, loginAsReader } from './fixtures';

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

const EPUB_URL = 'http://127.0.0.1:0/test/offline-test.epub';

/** Visible text of the rendered epub.js chapter iframe (null before rendition). */
async function getChapterText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe?.contentDocument?.body?.textContent ?? null;
  });
}

// ---------------------------------------------------------------------------
// Offline reader test suite
// ---------------------------------------------------------------------------

test.describe('Offline reader', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    await mockReaderApi(page, {
      bookSlug: TEST_USER.bookSlug,
      epubUrl: EPUB_URL,
      epubBuffer: EPUB_BUFFER,
      loginResponse: LOGIN_RESPONSE,
    });
  });

  test('@mobile @pwa offline reload renders the cached chapter and survives reconnect', async ({
    page,
    context,
  }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    // Online, uncontrolled load: the fixture renders and the signed file URL
    // is cached in the (encrypted) offline DB for the fallback below.
    await expect
      .poll(() => getChapterText(page), { timeout: 30_000 })
      .toContain('OFFLINE TEST CONTENT');

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

    // SW/cache ready: seed the EPUB bytes into the cache the SW's
    // external-assets StaleWhileRevalidate route reads (the mock book URL is
    // cross-origin and unroutable, so the SW cannot populate it online).
    await page.evaluate(
      async ({ url, bytes }) => {
        const cache = await caches.open('external-assets');
        await cache.put(
          url,
          new Response(new Uint8Array(bytes), {
            headers: { 'Content-Type': 'application/epub+zip' },
          }),
        );
      },
      { url: EPUB_URL, bytes: Array.from(EPUB_BUFFER) },
    );

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
    await page.waitForTimeout(500);

    const isOffline = await page.evaluate(() => navigator.onLine);
    expect(isOffline).toBe(false);

    const bodyOk = await page
      .locator('body')
      .isVisible()
      .catch(() => false);
    expect(bodyOk).toBe(true);

    await context.setOffline(false);
    await page.waitForTimeout(500);

    const backOnline = await page.evaluate(() => navigator.onLine);
    expect(backOnline).toBe(true);
  });

  test('@mobile @pwa serves cached API responses while offline (NetworkFirst strategy)', async ({
    page,
    context,
  }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    // The worker uses registerType 'prompt' (no clients.claim: update control
    // stays with the user), so only pages loaded after SW activation are
    // controlled. Reload before asserting control — if the SW still does not
    // control the page after reload, the hard assert below fails loudly
    // (E2E-02: never silently skip missing SW control).
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const swActive = await page.evaluate(async () => {
      try {
        const _registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);
        return !!navigator.serviceWorker.controller;
      } catch {
        return false;
      }
    });

    expect(swActive, 'Service Worker must be active and controlling the page in pwa-chromium').toBe(
      true,
    );
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
    await page.waitForTimeout(300);

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
    await loginAsReader(page, TEST_USER.bookSlug);

    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Queue an offline action into the application's sync queue
    await page.evaluate(async (slug) => {
      const DB_NAME = 'do-epub-studio';
      const STORE_NAME = 'syncQueue';
      const item = {
        id: crypto.randomUUID(),
        type: 'annotation',
        payload: {
          bookId: slug,
          annotation: {
            type: 'bookmark',
            cfi: 'epubcfi(/6/4!/4)',
            chapter: 'ch1',
            text: 'Offline bookmark',
          },
        },
        mutationId: crypto.randomUUID(),
        createdAt: Date.now(),
        attempts: 0,
      };

      const { promise, resolve, reject } = Promise.withResolvers<void>();
      const req = indexedDB.open(DB_NAME);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      await promise;
    }, TEST_USER.bookSlug);

    // Query the application's IndexedDB syncQueue unconditionally
    const queuedEntries = await page.evaluate(async () => {
      const { promise, resolve, reject } =
        Promise.withResolvers<
          Array<{ id: string; type: string; payload: Record<string, unknown> }>
        >();
      const req = indexedDB.open('do-epub-studio');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('syncQueue', 'readonly');
          const store = tx.objectStore('syncQueue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result);
          getAllReq.onerror = () => reject(getAllReq.error);
        } catch (err) {
          reject(err);
        }
      };
      return promise;
    });

    expect(queuedEntries.length, 'Offline action must be queued in syncQueue').toBeGreaterThan(0);
    expect(
      queuedEntries.some((e) => e.type === 'annotation'),
      'Queued action should have annotation type',
    ).toBe(true);

    await context.setOffline(false);
    await page.waitForTimeout(500);

    const bodyOk = await page
      .locator('body')
      .isVisible()
      .catch(() => false);
    expect(bodyOk).toBe(true);
  });

  test('@mobile @pwa flushes sync queue after reconnection', async ({ page, context }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    const syncBookmarks: { url: string; body: string }[] = [];
    await page.route('**/api/books/*/bookmarks', async (route: Route) => {
      if (route.request().method() === 'POST') {
        syncBookmarks.push({ url: route.request().url(), body: route.request().postData() ?? '' });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { id: 'synced-bookmark' } }),
      });
    });

    await page.route('**/api/books/*/highlights', async (route: Route) => {
      if (route.request().method() === 'POST') {
        syncBookmarks.push({ url: route.request().url(), body: route.request().postData() ?? '' });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { id: 'synced-highlight' } }),
      });
    });

    await page.route('**/api/books/*/progress', async (route: Route) => {
      if (route.request().method() === 'PUT') {
        syncBookmarks.push({ url: route.request().url(), body: route.request().postData() ?? '' });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: {} }),
      });
    });

    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Add items to the IndexedDB sync queue (not raw fetch) so attemptSync()
    // processes them on reconnection.  Uses the same queueSync path the app uses.
    await page.evaluate(async () => {
      const DB_NAME = 'do-epub-studio';
      const STORE_NAME = 'syncQueue';
      const items = [
        {
          id: crypto.randomUUID(),
          type: 'annotation',
          payload: {
            bookId: 'offline-test',
            annotation: {
              type: 'bookmark',
              cfi: 'epubcfi(/6/4!/4)',
              chapter: 'ch1',
              text: 'Offline bookmark',
            },
          },
          mutationId: crypto.randomUUID(),
          createdAt: Date.now(),
          attempts: 0,
        },
        {
          id: crypto.randomUUID(),
          type: 'annotation',
          payload: {
            bookId: 'offline-test',
            annotation: {
              type: 'highlight',
              cfi: 'epubcfi(/6/6)',
              chapter: 'ch1',
              text: 'Offline highlight',
              color: '#ffff00',
            },
          },
          mutationId: crypto.randomUUID(),
          createdAt: Date.now() + 1,
          attempts: 0,
        },
        {
          id: crypto.randomUUID(),
          type: 'progress',
          payload: {
            bookId: 'offline-test',
            cfi: 'epubcfi(/6/8)',
            percentage: 0.5,
            mutationId: crypto.randomUUID(),
          },
          mutationId: crypto.randomUUID(),
          createdAt: Date.now() + 2,
          attempts: 0,
        },
      ];

      await new Promise<void>((resolve, reject) => {
        // `req.error` and `tx.error` are `DOMException | null`, so rejecting with
        // them directly can settle the promise with a non-Error. Normalise, or a
        // real IndexedDB failure surfaces as an unhelpful `null` rejection.
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed with no error'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          for (const item of items) store.put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(tx.error ?? new Error('IndexedDB transaction failed with no error'));
        };
      });
    });

    const queuedBeforeReconnect = syncBookmarks.length;

    await context.setOffline(false);
    // Wait for sync queue to flush — poll the intercepted API calls
    // instead of a hardcoded timeout.  Each queued item produces one
    // POST/PUT to the route handlers above, which push into syncBookmarks.
    await expect
      .poll(() => syncBookmarks.length, {
        timeout: 10_000,
        message: 'Sync queue should flush offline items after reconnection',
      })
      .toBeGreaterThan(queuedBeforeReconnect);

    const bodyOk = await page
      .locator('body')
      .isVisible()
      .catch(() => false);
    expect(bodyOk).toBe(true);
  });
});
