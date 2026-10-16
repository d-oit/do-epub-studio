import { test, expect } from '@playwright/test';
import { encryptJSON, decryptJSON } from '../web/src/lib/offline/crypto';
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
    // The fixture has 2 chapters (itemrefs c1 at /6/2, c2 at /6/4). CFIs point
    // to paragraph p1 in chapter 1 and p2 in chapter 2.
    const initialCfi = 'epubcfi(/6/2[c1]!/4/2[p1]/1:0)';
    const updatedCfi = 'epubcfi(/6/4[c2]!/4/2[p2]/1:0)';
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
    const contentFrame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(contentFrame.getByText('First chapter passage content')).toBeVisible();
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
    await expect(contentFrame.getByText('Second chapter passage content')).toBeVisible();
  });

  test('@mobile should fallback to IndexedDB if network is offline', async ({ page }) => {
    const bookId = 'test-book';
    const initialCfi = 'epubcfi(/6/2[c1]!/4/2[p1]/1:0)';
    const updatedCfi = 'epubcfi(/6/4[c2]!/4/2[p2]/1:0)';

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
    const contentFrame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(contentFrame.getByText('First chapter passage content')).toBeVisible();
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
    await expect(contentFrame.getByText('Second chapter passage content')).toBeVisible();
  });

  test('@mobile keeps saving the reading position while the browser reports offline', async ({
    page,
  }) => {
    const bookId = 'test-book';
    const sessionToken = 'mock-token';
    const seededCfi = 'epubcfi(/6/2[c1]!/4/2[p1]/1:0)';
    // Function declaration, not a const arrow: Codacy's Biome engine flags
    // `const x = () => ...` in specs with the Qwik `useQwikValidLexicalScope`
    // false positive (this project is React; see agents-docs/LEARNINGS.md).
    function offlineLoaded(msg: { text(): string }): boolean {
      return (
        msg.text().includes('reader.progress_loaded') && msg.text().includes('"source":"offline"')
      );
    }

    // The reload reports `navigator.onLine === false`, so the reader takes the
    // offline branch of the initial load. The existing fallback test emulates
    // unreachability by aborting a route, which keeps `onLine` true and takes
    // the online-then-catch path instead — this branch had no browser cover.
    // Routes still serve the shell and the EPUB: the branch under test is the
    // app's own offline decision, not a killed document navigation.
    await page.addInitScript(
      ({ token, bid }) => {
        window.localStorage.setItem(
          'do-epub-auth',
          JSON.stringify({
            state: {
              sessionToken: token,
              bookId: bid,
              bookSlug: bid,
              isAuthenticated: true,
            },
          }),
        );
        Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      },
      { token: sessionToken, bid: bookId },
    );

    await page.route(`**/api/books/${bookId}/file-url`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: '/mock-book.epub' } }),
      }),
    );
    await page.route('**/mock-book.epub', (route) =>
      route.fulfill({ status: 200, contentType: 'application/epub+zip', body: TEST_EPUB }),
    );
    await page.route('**/api/books/**/highlights', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/comments', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );
    await page.route('**/api/books/**/bookmarks', (route) =>
      route.fulfill({ body: JSON.stringify({ ok: true, data: [] }) }),
    );

    // First load: no durable row yet, so the reader restores nothing and the
    // load settling is what re-enables persistence (source stays `default`).
    const firstLoad = page.waitForEvent('console', (msg) =>
      msg.text().includes('reader.progress_loaded'),
    );
    await page.goto(`/read/${bookId}`);
    await firstLoad;

    // Durable position, encrypted with the app's own crypto (see the fallback
    // test's note: plaintext rows are refused by design, #1284).
    const progressCiphertext = await encryptJSON(
      {
        cfi: seededCfi,
        percentage: 75,
        lastRead: Date.now(),
        mutationId: 'offline-mut-progress-75',
      },
      sessionToken,
    );
    await page.evaluate(
      async ({ bid, encryptedPayload }) => {
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        const req = indexedDB.open('do-epub-studio');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('progress', 'readwrite');
          tx.objectStore('progress').put({
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

    const restoredLoad = page.waitForEvent('console', offlineLoaded);
    await page.reload();
    await restoredLoad;

    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('progressbar', { name: /Reading Progress/i })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    const contentFrame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(contentFrame.getByText('First chapter passage content')).toBeVisible();

    // A page turn must still be recorded: the relocation handler is gated
    // until the offline load settles, and a gate that never lifts drops every
    // position read offline instead of persisting it.
    await page.keyboard.press('ArrowRight');
    await expect(contentFrame.getByText('Second chapter passage content')).toBeVisible();
    await expect
      .poll(
        async () => {
          const ciphertext = await page.evaluate(async (bid) => {
            const { promise, resolve } = Promise.withResolvers<string | null>();
            const req = indexedDB.open('do-epub-studio');
            req.onerror = () => resolve(null);
            req.onsuccess = () => {
              const tx = req.result.transaction('progress', 'readonly');
              const get = tx.objectStore('progress').get(`${bid}-progress`);
              get.onsuccess = () => {
                const row = get.result as { encryptedPayload?: string } | undefined;
                resolve(row?.encryptedPayload ?? null);
              };
              get.onerror = () => resolve(null);
            };
            return promise;
          }, bookId);
          const cfi = ciphertext
            ? (await decryptJSON<{ cfi: string }>(ciphertext, sessionToken)).cfi
            : null;
          // True only for a recorded, moved position: an untouched or missing
          // row must fail rather than pass as "different".
          return cfi !== null && cfi !== seededCfi;
        },
        { timeout: 15000 },
      )
      .toBe(true);
  });
});
