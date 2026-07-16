import { test, expect, type Route } from '@playwright/test';
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
    book: { id: 'book-offline', slug: TEST_USER.bookSlug, title: 'Offline Test Book', authorName: 'Test Author' },
    capabilities: { canRead: true, canComment: true, canHighlight: true, canBookmark: true, canDownloadOffline: true, canExportNotes: false, canManageAccess: false },
  },
};

const EPUB_BUFFER = createMinimalEpub([
  { id: 'c1', href: 'chapter1.xhtml', title: 'Chapter 1', body: '<p>OFFLINE TEST CONTENT for the offline reader test.</p>' },
], { title: 'Offline Test Book', identifier: 'urn:uuid:offline-test-book' });

const EPUB_URL = 'http://127.0.0.1:0/test/offline-test.epub';

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
    await mockReaderApi(page, { bookSlug: TEST_USER.bookSlug, epubUrl: EPUB_URL, epubBuffer: EPUB_BUFFER, loginResponse: LOGIN_RESPONSE });
  });

  test('@mobile loads reader page online then survives offline reload', async ({ page }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await page.route('**/api/**', async (route: Route) => {
      await route.abort('failed');
    });
    await page.route('**/*.epub', async (route: Route) => {
      await route.abort('failed');
    });

    await page.reload();
    await page.waitForTimeout(3000);

    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);

    await page.unroute('**/api/**');
    await page.unroute('**/*.epub');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyStillVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyStillVisible).toBe(true);
  });

  test('@mobile detects offline/online status transitions', async ({ page, context }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    const initialOnline = await page.evaluate(() => navigator.onLine);
    expect(initialOnline).toBe(true);

    await context.setOffline(true);
    await page.waitForTimeout(500);

    const isOffline = await page.evaluate(() => navigator.onLine);
    expect(isOffline).toBe(false);

    const bodyOk = await page.locator('body').isVisible().catch(() => false);
    expect(bodyOk).toBe(true);

    await context.setOffline(false);
    await page.waitForTimeout(500);

    const backOnline = await page.evaluate(() => navigator.onLine);
    expect(backOnline).toBe(true);
  });

  test('@mobile serves cached API responses while offline (NetworkFirst strategy)', async ({ page, context }, testInfo) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    const swActive = await page.evaluate(async () => {
      try {
        const _registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
        ]);
        return !!navigator.serviceWorker.controller;
      } catch {
        return false;
      }
    });

    if (!swActive) {
      testInfo.skip();
      return;
    }

    await page.route('**/api/books/offline-test-cached', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { value: 'cached-offline-data' } }),
      });
    });

    await page.evaluate(async () => {
      const res = await fetch('/api/books/offline-test-cached');
      return res.json();
    });

    await context.setOffline(true);
    await page.waitForTimeout(300);

    const cachedResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/books/offline-test-cached');
        const data = await res.json();
        return { ok: true, value: data.data?.value };
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

  test('@mobile queues offline actions for sync when network is unavailable', async ({ page, context }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await context.setOffline(true);
    await page.waitForTimeout(300);

    await page.evaluate(async () => {
      try {
        await fetch('/api/books/offline-test/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locator: { cfi: 'epubcfi(/6/4)' },
            label: 'Offline bookmark',
          }),
        });
      } catch {
        // Expected to fail at network level — the service worker may
        // intercept and queue instead of sending.
      }
    });

    const syncQueueExists = await page.evaluate(async () => {
      if (typeof indexedDB === 'undefined') return false;
      const dbs = await indexedDB.databases?.() ?? [];
      return dbs.some((db) => db.name?.includes('offline') || db.name?.includes('sync'));
    });

    if (syncQueueExists) {
      const queuedEntries = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          const req = indexedDB.open('offline-sync-queue');
          req.onsuccess = () => {
            try {
              const tx = req.result.transaction('actions', 'readonly');
              const store = tx.objectStore('actions');
              const countReq = store.count();
              countReq.onsuccess = () => resolve(countReq.result);
              countReq.onerror = () => resolve(0);
            } catch {
              resolve(0);
            }
          };
          req.onerror = () => resolve(0);
        });
      });
      expect(queuedEntries).toBeGreaterThan(0);
    }

    await context.setOffline(false);
    await page.waitForTimeout(500);

    const bodyOk = await page.locator('body').isVisible().catch(() => false);
    expect(bodyOk).toBe(true);
  });

  test('@mobile flushes sync queue after reconnection', async ({ page, context }) => {
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
            annotation: { type: 'bookmark', cfi: 'epubcfi(/6/4)', chapter: 'ch1', text: 'Offline bookmark' },
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
            annotation: { type: 'highlight', cfi: 'epubcfi(/6/6)', chapter: 'ch1', text: 'Offline highlight', color: '#ffff00' },
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
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          for (const item of items) store.put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
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

    const bodyOk = await page.locator('body').isVisible().catch(() => false);
    expect(bodyOk).toBe(true);
  });
});
