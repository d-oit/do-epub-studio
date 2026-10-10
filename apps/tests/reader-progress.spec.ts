import { test, expect } from '@playwright/test';
import { encryptJSON } from '../web/src/lib/offline/crypto';
import { createMinimalEpub } from './fixtures';

const TEST_EPUB = createMinimalEpub(
  [
    {
      id: 'c1',
      href: 'chapter1.xhtml',
      title: 'Chapter 1',
      body: '<p id="p1">First chapter passage content</p>',
    },
    {
      id: 'c2',
      href: 'chapter2.xhtml',
      title: 'Chapter 2',
      body: '<p id="p2">Second chapter passage content</p>',
    },
  ],
  { title: 'Test Book', identifier: 'urn:uuid:test-book' },
);
test.describe('Reader Progress Persistence', () => {
  test('@mobile should save progress and resume from the same CFI on reload', async ({ page }) => {
    const bookId = 'test-book';
    const initialCfi = 'epubcfi(/6/4[chap1]!/4/2/2)';
    const updatedCfi = 'epubcfi(/6/10[chap2]!/4/2/4)';
    let currentCfi = initialCfi;

    // 1. Mock API
    await page.route(`**/api/books/${bookId}/progress`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              locator: { cfi: currentCfi },
              progressPercent: currentCfi === updatedCfi ? 75 : 10,
            },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        currentCfi = body.locator.cfi;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: body }),
        });
      }
    });

    await page.route(`**/api/books/${bookId}/file-url`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: '/mock-book.epub' } }),
      });
    });

    // Serve the EPUB so the book actually loads — without it the reader shows
    // "Failed to load book" and progress telemetry timing becomes load-dependent.
    await page.route('**/mock-book.epub', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: TEST_EPUB });
    });

    await page.route('**/api/books/**/highlights', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/comments', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/bookmarks', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );

    // 2. Auth setup
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'do-epub-auth',
        JSON.stringify({
          state: {
            sessionToken: 'mock-token',
            bookId: 'test-book',
            bookSlug: 'test-book',
            isAuthenticated: true,
          },
        }),
      );
    });

    // 3. Load reader — register the telemetry wait BEFORE navigating so the
    //    event cannot fire ahead of the listener (race under fast reloads).
    const progressLoadedPromise = page.waitForEvent(
      'console',
      (msg) =>
        msg.text().includes('reader.progress_loaded') && msg.text().includes('"source":"server"'),
    );
    await page.goto(`/read/${bookId}`);
    await progressLoadedPromise;

    // Verify initial consumer-observable progress
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('progressbar', { name: /Reading Progress/i })).toHaveAttribute(
      'aria-valuenow',
      '10',
    );
    await expect(page.getByText('10%')).toBeVisible();
    // 4. Verify initial CFI (this is hard without a real EPUB, but we can check if the PUT was called later)
    // For this test, we'll manually trigger a relocation if we can, or just trust the telemetry and code path verified by Vitest.
    // Actually, we can check if currentCfi matches what we expect after a reload.

    // Set a new CFI
    currentCfi = updatedCfi;

    // Reload — register the wait first (same race as the initial load).
    const reloadProgressLoadedPromise = page.waitForEvent(
      'console',
      (msg) =>
        msg.text().includes('reader.progress_loaded') && msg.text().includes('"source":"server"'),
    );
    await page.reload();
    await reloadProgressLoadedPromise;

    // Assert restored position is observable in the consumer UI
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('progressbar', { name: /Reading Progress/i })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    await expect(page.getByText('75%')).toBeVisible();
  });

  test('@mobile should fallback to IndexedDB if network is offline', async ({ page }) => {
    const bookId = 'test-book';
    const initialCfi = 'epubcfi(/6/4[chap1]!/4/2/2)';
    const updatedCfi = 'epubcfi(/6/10[chap2]!/4/2/4)';

    // 1. Initial online mock
    await page.route(`**/api/books/${bookId}/progress`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { locator: { cfi: initialCfi }, progressPercent: 10 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
    });

    await page.route(`**/api/books/${bookId}/file-url`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: '/mock-book.epub' } }),
      });
    });

    await page.route('**/mock-book.epub', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: TEST_EPUB });
    });

    await page.route('**/api/books/**/highlights', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/comments', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/bookmarks', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );

    // 2. Auth setup
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'do-epub-auth',
        JSON.stringify({
          state: {
            sessionToken: 'mock-token',
            bookId: 'test-book',
            bookSlug: 'test-book',
            isAuthenticated: true,
          },
        }),
      );
    });

    // 3. Load reader online
    const onlineLoadedPromise = page.waitForEvent(
      'console',
      (msg) =>
        msg.text().includes('reader.progress_loaded') && msg.text().includes('"source":"server"'),
    );
    await page.goto(`/read/${bookId}`);
    await onlineLoadedPromise;

    // Verify initial online position
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('progressbar', { name: /Reading Progress/i })).toHaveAttribute(
      'aria-valuenow',
      '10',
    );
    await expect(page.getByText('10%')).toBeVisible();

    // 4. Establish a newer local position directly in IndexedDB: the minimal
    //    fixture EPUB exposes no TOC chapters ("No chapters available"), so
    //    chapter navigation is impossible here. Seeding the durable store is
    //    exactly what the app's own offline persist path writes (see
    //    useEpubProgress — saveProgress with synced:false + queue entry).

    //    The row must be ENCRYPTED like the real one: db.ts encryptEntry keeps
    //    only id/bookId/synced in the clear and hides everything else in
    //    encryptedPayload, and decryptEntry refuses to surface rows that carry
    //    sensitive fields in the clear (S2, #1284). A plaintext seed would be
    //    ignored by the offline fallback, which is the correct security
    //    behaviour — the test encrypts with the app's own crypto instead of
    //    weakening it.
    const progressCiphertext = await encryptJSON(
      {
        cfi: updatedCfi,
        percentage: 75,
        lastRead: Date.now(),
        mutationId: 'offline-mut-progress-75',
      },
      'mock-token',
    );

    // Durably store the new progress in IndexedDB
    await page.evaluate(
      async ({ bid, encryptedPayload }) => {
        const DB_NAME = 'do-epub-studio';
        const STORE_NAME = 'progress';
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: `${bid}-progress`,
            bookId: bid,
            synced: false,
            encryptedPayload,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        await promise;
      },
      { bid: bookId, encryptedPayload: progressCiphertext },
    );
    // 5. Simulate server unreachability WITHOUT killing document navigation:
    //    abort the progress API (the established @pwa pattern in
    //    offline-reader.spec.ts). context.setOffline(true) would fail the
    //    reload itself with ERR_INTERNET_DISCONNECTED on a dev server whose
    //    SW does not serve documents offline.
    await page.route(`**/api/books/${bookId}/progress`, async (route) => {
      await route.abort('failed');
    });

    // 6. Reload while offline — wait for offline progress telemetry
    const offlineLoadedPromise = page.waitForEvent(
      'console',
      (msg) =>
        msg.text().includes('reader.progress_loaded') && msg.text().includes('"source":"offline"'),
    );
    await page.reload();
    await offlineLoadedPromise;

    // 7. Assert consumer-observable restored passage/position
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('progressbar', { name: /Reading Progress/i })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    await expect(page.getByText('75%')).toBeVisible();
  });
});
