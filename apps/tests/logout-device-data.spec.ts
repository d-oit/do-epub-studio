/**
 * S1 (GOAP-1002) — browser-level proof that the visible reader sign-out purges
 * device-local reader data.
 *
 * The source-level tests (`apps/web/src/__tests__/logout-teardown.test.ts`,
 * `apps/web/src/__tests__/useReaderLogout.test.tsx`) cover the purge
 * primitive and the logout hook in isolation. This spec exercises the real
 * browser path instead:
 *
 *   1. the accessible "Sign Out" control of the reader toolbar,
 *   2. the real `do-epub-studio` IndexedDB database with representative rows
 *      in `annotations`, `readingInsights`, `feedbackDrafts` and `bookFiles`,
 *   3. the real Cache Storage `book-content` cache with a book payload,
 *   4. the resulting navigation to `/login` and the unmounted reader.
 *
 * Scope limits (recorded honestly, per the S1 acceptance note):
 *   - The seeded rows are asserted to be GONE. Nothing here claims that
 *     another account can (or cannot) decrypt the ciphertext that existed
 *     before the purge.
 *   - Nothing here claims deployed behaviour; the Worker/API is mocked with
 *     the existing reader fixtures.
 *
 * The `@pwa` test adds the offline revisit: with a controlling service worker
 * the purged book file must not be servable from the cache any more. The
 * `@pwa` lane needs the built app (`PLAYWRIGHT_MODE=preview`) — the dev
 * server ships no service worker, so that lane asserts SW control loudly
 * instead of silently skipping (E2E-02).
 */

import { test, expect, type Page } from '@playwright/test';
import { encryptJSON } from '../web/src/lib/offline/crypto';
import {
  createMinimalEpub,
  loginAsReader,
  mockReaderApi,
  TEST_USER,
  waitForServiceWorkerActivation,
} from './fixtures';

// ---------------------------------------------------------------------------
// Constants (fake data on reserved domains only)
// ---------------------------------------------------------------------------

/** Matches `DB_NAME`/`DB_VERSION` in `apps/web/src/lib/offline/db.ts`. */
const DB_NAME = 'do-epub-studio';
const DB_VERSION = 5;
/** The four user-specific stores this spec seeds and then checks. */
const USER_STORES = ['annotations', 'readingInsights', 'feedbackDrafts', 'bookFiles'] as const;

const BOOK_SLUG = 'logout-teardown-book';
const BOOK_ID = 'book-logout-teardown';
const BOOK_TITLE = 'Logout Teardown Book';
/**
 * Key of the seeded rows. Deliberately distinct from the open book's id: the
 * app writes its own `bookFiles` row (the signed file URL) under the open
 * book's id, and a late app write must never overwrite the seeded row.
 */
const SEEDED_BOOK_ID = 'book-logout-teardown-seeded';
/** Marker rendered inside the sandboxed book frame — proves the book rendered. */
const CHAPTER_MARKER = 'LOGOUT TEARDOWN CHAPTER CONTENT';
/** Fake session token; used only to encrypt the seeded rows. */
const SESSION_TOKEN = 'logout-teardown-session-token';
/** Same-origin path the service worker's `book-content` route matches. */
const BOOK_FILE_CACHE_PATH = `/api/files/${BOOK_ID}/logout-teardown.epub`;
/** Same-origin EPUB path served through the mocked route. */
const EPUB_PATH = `/e2e/${BOOK_SLUG}.epub`;
/** Seeded insight bucket key — the app only ever writes today's date key. */
const SEEDED_INSIGHT_DATE = '2020-06-15';

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: SESSION_TOKEN,
    book: {
      id: BOOK_ID,
      slug: BOOK_SLUG,
      title: BOOK_TITLE,
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
      body: `<p>${CHAPTER_MARKER}</p>`,
    },
  ],
  { title: BOOK_TITLE, identifier: 'urn:uuid:logout-teardown-book' },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoreCounts = Record<(typeof USER_STORES)[number], number>;

interface CacheState {
  /** `book-content` is still listed in `caches.keys()`. */
  cacheExists: boolean;
  /** The seeded book payload is still retrievable from `book-content`. */
  entryFound: boolean;
}

interface SeedPayload {
  annotation: Record<string, unknown>;
  insight: Record<string, unknown>;
  draft: Record<string, unknown>;
  bookFile: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Page-error guard
// ---------------------------------------------------------------------------

/**
 * Tolerate the page errors this scenario provokes on purpose, and rethrow
 * everything else.
 *
 * Signing out tears the session down first and unmounts the reader second, so
 * the reader's unmount flush tries to persist progress *after* the session is
 * gone. The app fails closed there (S2: `encryptEntry` refuses to write
 * without a session), which surfaces as an aborted/unauthorized persistence
 * rejection. That is the designed behaviour of the teardown, not an app
 * defect, so it must not fail the run — every other page error still does.
 */
function tolerateExpectedTeardownErrors(page: Page): void {
  page.on('pageerror', (error) => {
    const message = error.message;
    // Workbox SW registration noise (same list as the shared helper).
    if (message.includes("reading 'waiting'")) return;
    // Environmental network noise of the mocked preview environment.
    if (
      /Failed to load resource|ERR_CONNECTION_REFUSED|access control checks|Failed to fetch|AbortError|net::ERR_|Worker initialization failed/i.test(
        message,
      )
    ) {
      return;
    }
    // The reader's unmount flush after the session was already torn down.
    if (/Authentication required for sensitive offline storage/i.test(message)) return;
    if (/Session expired/i.test(message)) return;
    throw error;
  });
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Build the rows exactly the way the app stores them: routing fields in the
 * clear, everything else inside `encryptedPayload` (AES-GCM, keyed by the
 * session token). A plaintext seed would be refused by `decryptEntry` (S2),
 * so encrypting with the app's own crypto keeps the seed realistic.
 */
async function buildEncryptedSeedPayload(): Promise<SeedPayload> {
  const annotationCiphertext = await encryptJSON(
    {
      type: 'highlight',
      cfi: 'epubcfi(/6/2[c1]!/4/2/1:0)',
      endCfi: 'epubcfi(/6/2[c1]!/4/2/1:12)',
      text: 'LOGOUT TEARDOWN ANNOTATION',
      color: '#ffff00',
      chapter: 'chapter1.xhtml',
      createdAt: 1_767_225_600_000,
      mutationId: 'mutation-logout-teardown-annotation',
    },
    SESSION_TOKEN,
  );
  const insightCiphertext = await encryptJSON(
    {
      activeMinutes: 12,
      activePages: 3,
      lastUpdated: 1_767_225_600_000,
    },
    SESSION_TOKEN,
  );
  const draftCiphertext = await encryptJSON(
    {
      kind: 'suggestion',
      category: 'grammar',
      body: 'LOGOUT TEARDOWN DRAFT',
      anchor: { selectedText: CHAPTER_MARKER, chapterRef: 'chapter1.xhtml' },
      createdAt: 1_767_225_600_000,
      updatedAt: 1_767_225_600_000,
    },
    SESSION_TOKEN,
  );
  const bookFileCiphertext = await encryptJSON(
    {
      url: `https://example.com/${BOOK_SLUG}.epub`,
      fileId: 'file-logout-teardown',
    },
    SESSION_TOKEN,
  );

  return {
    annotation: {
      id: 'annotation-logout-teardown',
      bookId: SEEDED_BOOK_ID,
      synced: false,
      encryptedPayload: annotationCiphertext,
    },
    insight: {
      bookId: SEEDED_BOOK_ID,
      date: SEEDED_INSIGHT_DATE,
      encryptedPayload: insightCiphertext,
    },
    draft: {
      id: 'draft-logout-teardown',
      bookId: SEEDED_BOOK_ID,
      ownerEmail: TEST_USER.email,
      mutationId: 'mutation-logout-teardown',
      delivery: 'draft',
      encryptedPayload: draftCiphertext,
    },
    bookFile: {
      bookId: SEEDED_BOOK_ID,
      cachedAt: 1_767_225_600_000,
      encryptedPayload: bookFileCiphertext,
    },
  };
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

/**
 * Open (and if necessary create) the app's offline database in the browser.
 *
 * The store layout mirrors `apps/web/src/lib/offline/db.ts` (DB_VERSION 5).
 * The app creates this database itself, but its upgrade callback only creates
 * the v1 stores when `oldVersion < 1` — a database created by an earlier open
 * at version 1 would leave the app without `progress`, `annotations`,
 * `syncQueue`, `permissions` and `readingInsights`. Mirroring the schema here
 * keeps the seed valid no matter which side opens the database first.
 */
async function openOfflineDatabase(page: Page): Promise<void> {
  await page.evaluate(
    async ({ dbName, dbVersion }) => {
      function createAppStores(db: IDBDatabase): void {
        if (!db.objectStoreNames.contains('progress')) {
          const store = db.createObjectStore('progress', { keyPath: 'id' });
          store.createIndex('bookId', 'bookId');
          store.createIndex('synced', 'synced');
        }
        if (!db.objectStoreNames.contains('annotations')) {
          const store = db.createObjectStore('annotations', { keyPath: 'id' });
          store.createIndex('bookId', 'bookId');
          store.createIndex('synced', 'synced');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('permissions')) {
          db.createObjectStore('permissions', { keyPath: 'bookId' });
        }
        if (!db.objectStoreNames.contains('readingInsights')) {
          const store = db.createObjectStore('readingInsights', { keyPath: ['bookId', 'date'] });
          store.createIndex('bookId', 'bookId');
        }
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('feedbackDrafts')) {
          const store = db.createObjectStore('feedbackDrafts', { keyPath: 'id' });
          store.createIndex('ownerBook', ['ownerEmail', 'bookId']);
        }
        if (!db.objectStoreNames.contains('bookFiles')) {
          db.createObjectStore('bookFiles', { keyPath: 'bookId' });
        }
      }

      function openWithVersion(): Promise<IDBDatabase> {
        const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
        const request = indexedDB.open(dbName, dbVersion);
        request.onupgradeneeded = () => createAppStores(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => resolve(request.result);
        return promise;
      }

      function openCurrent(): Promise<IDBDatabase> {
        const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => resolve(request.result);
        return promise;
      }

      let db: IDBDatabase;
      try {
        db = await openWithVersion();
      } catch (error) {
        // A newer app version already owns the database: reopen it without
        // pinning the version instead of failing the run.
        if (error instanceof DOMException && error.name === 'VersionError') {
          db = await openCurrent();
        } else {
          throw error;
        }
      }
      db.close();
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION },
  );
}

/**
 * Seed the app's offline database with one representative row per
 * user-specific store.
 */
async function seedDeviceRows(page: Page): Promise<void> {
  await openOfflineDatabase(page);
  const payload = await buildEncryptedSeedPayload();

  await page.evaluate(
    async ({ dbName, seed }) => {
      const {
        promise: dbPromise,
        resolve: resolveDb,
        reject: rejectDb,
      } = Promise.withResolvers<IDBDatabase>();
      const request = indexedDB.open(dbName);
      request.onerror = () => rejectDb(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => resolveDb(request.result);
      const db = await dbPromise;
      const stores = ['annotations', 'readingInsights', 'feedbackDrafts', 'bookFiles'];
      const write = db.transaction(stores, 'readwrite');
      write.objectStore('annotations').put(seed.annotation);
      write.objectStore('readingInsights').put(seed.insight);
      write.objectStore('feedbackDrafts').put(seed.draft);
      write.objectStore('bookFiles').put(seed.bookFile);
      const {
        promise: writePromise,
        resolve: resolveWrite,
        reject: rejectWrite,
      } = Promise.withResolvers<void>();
      write.oncomplete = () => resolveWrite();
      write.onerror = () => rejectWrite(write.error ?? new Error('seed write failed'));
      write.onabort = () => rejectWrite(write.error ?? new Error('seed write aborted'));
      await writePromise;
      db.close();
    },
    { dbName: DB_NAME, seed: payload },
  );
}

/**
 * Row counts of the user-specific stores (read-only, no schema upgrade).
 *
 * The counts speak about the stores as a whole: they include the app's own
 * rows (the signed file URL in `bookFiles`) and must be zero once the
 * teardown ran.
 */
async function readStoreCounts(page: Page): Promise<StoreCounts> {
  await openOfflineDatabase(page);
  return page.evaluate(
    async ({ dbName, stores }) => {
      const {
        promise: dbPromise,
        resolve: resolveDb,
        reject: rejectDb,
      } = Promise.withResolvers<IDBDatabase>();
      const openRequest = indexedDB.open(dbName);
      openRequest.onerror = () => rejectDb(openRequest.error ?? new Error('IndexedDB open failed'));
      openRequest.onsuccess = () => resolveDb(openRequest.result);
      const db = await dbPromise;
      const missing = stores.filter((name) => !db.objectStoreNames.contains(name));
      if (missing.length > 0) {
        db.close();
        throw new Error(`Missing offline stores: ${missing.join(', ')}`);
      }

      const read = db.transaction(stores, 'readonly');
      const counts = await Promise.all(
        stores.map((name) => {
          const { promise, resolve, reject } = Promise.withResolvers<number>();
          const request = read.objectStore(name).count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('count failed'));
          return promise;
        }),
      );
      db.close();

      return {
        annotations: counts[0] ?? 0,
        readingInsights: counts[1] ?? 0,
        feedbackDrafts: counts[2] ?? 0,
        bookFiles: counts[3] ?? 0,
      };
    },
    { dbName: DB_NAME, stores: [...USER_STORES] },
  );
}

/** Whether the seeded rows are still present in the offline database. */
async function readSeededRowPresence(page: Page): Promise<StoreCounts> {
  await openOfflineDatabase(page);
  return page.evaluate(
    async ({ dbName, bookId, insightDate, annotationId, draftId }) => {
      const {
        promise: dbPromise,
        resolve: resolveDb,
        reject: rejectDb,
      } = Promise.withResolvers<IDBDatabase>();
      const openRequest = indexedDB.open(dbName);
      openRequest.onerror = () => rejectDb(openRequest.error ?? new Error('IndexedDB open failed'));
      openRequest.onsuccess = () => resolveDb(openRequest.result);
      const db = await dbPromise;
      const read = db.transaction(
        ['annotations', 'readingInsights', 'feedbackDrafts', 'bookFiles'],
        'readonly',
      );
      function lookup(
        store: string,
        key: IDBValidKey,
      ): Promise<Record<string, unknown> | undefined> {
        const { promise, resolve, reject } = Promise.withResolvers<
          Record<string, unknown> | undefined
        >();
        const request = read.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
        request.onerror = () => reject(request.error ?? new Error('read failed'));
        return promise;
      }

      const [annotation, insight, draft, bookFile] = await Promise.all([
        lookup('annotations', annotationId),
        lookup('readingInsights', [bookId, insightDate]),
        lookup('feedbackDrafts', draftId),
        lookup('bookFiles', bookId),
      ]);
      db.close();

      return {
        annotations: annotation ? 1 : 0,
        readingInsights: insight ? 1 : 0,
        feedbackDrafts: draft ? 1 : 0,
        bookFiles: bookFile ? 1 : 0,
      };
    },
    {
      dbName: DB_NAME,
      bookId: SEEDED_BOOK_ID,
      insightDate: SEEDED_INSIGHT_DATE,
      annotationId: 'annotation-logout-teardown',
      draftId: 'draft-logout-teardown',
    },
  );
}

/** Put the book payload into the `book-content` cache the app purges. */
async function seedBookContentCache(page: Page): Promise<void> {
  await page.evaluate(
    async ({ url, bytes }) => {
      const cache = await caches.open('book-content');
      await cache.put(
        url,
        new Response(new Uint8Array(bytes), {
          headers: { 'Content-Type': 'application/epub+zip' },
        }),
      );
    },
    { url: BOOK_FILE_CACHE_PATH, bytes: Array.from(EPUB_BUFFER) },
  );
}

/** Report whether `book-content` (and the seeded entry) survived. */
async function readBookContentCacheState(page: Page): Promise<CacheState> {
  return page.evaluate(
    async ({ url }) => {
      const cacheExists = (await caches.keys()).includes('book-content');
      let entryFound = false;
      if (cacheExists) {
        const cache = await caches.open('book-content');
        entryFound = Boolean(await cache.match(url));
      }
      return { cacheExists, entryFound };
    },
    { url: BOOK_FILE_CACHE_PATH },
  );
}

/** Text of every book iframe plus the epub content host. */
async function readReaderFrameText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll('iframe'));
    const frameText = frames
      .map((frame) => frame.contentDocument?.body?.textContent ?? '')
      .join(' ');
    const hostText = document.querySelector('[data-epub-content-host]')?.textContent ?? '';
    return `${frameText} ${hostText}`;
  });
}

/**
 * Activate the reader's visible "Sign Out" control.
 *
 * Wide viewports render it as a toolbar button; narrow viewports hide the
 * desktop action row behind the container-query overflow menu, where the
 * entry is a `menuitem`. Only a visible control is activated — dispatching on
 * the hidden desktop button would prove the handler, not the accessible
 * control a reader actually operates.
 */
async function clickVisibleSignOut(page: Page): Promise<void> {
  // The toolbar slides away when the page is scrolled down and becomes
  // `inert`; scroll back to the top so the control is operable.
  await page.evaluate(() => window.scrollTo(0, 0));

  const wideSignOut = page
    .locator('.cq-reader-toolbar-actions')
    .getByRole('button', { name: 'Sign Out' })
    .first();
  if (await wideSignOut.isVisible().catch(() => false)) {
    await wideSignOut.click();
    return;
  }

  const moreOptions = page
    .locator('.cq-reader-toolbar-overflow')
    .getByRole('button', { name: /more options/i })
    .first();
  await expect(moreOptions).toBeVisible({ timeout: 20000 });
  await moreOptions.click();
  const signOutMenuItem = page
    .locator('.cq-reader-toolbar-overflow')
    .getByRole('menuitem', { name: 'Sign Out' })
    .first();
  await expect(signOutMenuItem).toBeVisible({ timeout: 20000 });
  await signOutMenuItem.click();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('S1 reader sign-out device-data teardown (GOAP-1002)', () => {
  test.beforeEach(async ({ page }) => {
    tolerateExpectedTeardownErrors(page);
    await mockReaderApi(page, {
      bookSlug: BOOK_SLUG,
      epubUrl: EPUB_PATH,
      epubBuffer: EPUB_BUFFER,
      loginResponse: LOGIN_RESPONSE,
    });
  });

  test('@mobile visible sign-out purges reader rows and the book-content cache', async ({
    page,
  }) => {
    await loginAsReader(page, BOOK_SLUG);

    // The book really rendered before the sign-out — otherwise "no content
    // after logout" would be vacuously true.
    await expect
      .poll(() => readReaderFrameText(page), {
        timeout: 30000,
        message: 'The reader must render the book before sign-out',
      })
      .toContain(CHAPTER_MARKER);
    // The toolbar title proves the mocked session was the one in use. It is
    // read as text (not by role) because the toolbar can be aria-hidden while
    // the header is scrolled away.
    await expect
      .poll(() => page.locator('[data-container-name="reader-toolbar"] h1').first().innerText(), {
        timeout: 20000,
        message: 'The reader toolbar must show the book title',
      })
      .toContain(BOOK_TITLE);

    // The app caches the resolved signed file URL in `bookFiles` when it
    // loads the book. Waiting for that write keeps the seeded rows from
    // racing an app write that would land after the purge.
    await expect
      .poll(async () => (await readStoreCounts(page)).bookFiles, {
        timeout: 20000,
        message: 'The app must cache the signed book-file URL before sign-out',
      })
      .toBeGreaterThanOrEqual(1);

    // Seed representative device-local rows and the book-content cache entry.
    await seedDeviceRows(page);
    expect(await readSeededRowPresence(page)).toEqual({
      annotations: 1,
      readingInsights: 1,
      feedbackDrafts: 1,
      bookFiles: 1,
    });
    await seedBookContentCache(page);
    expect(await readBookContentCacheState(page)).toEqual({
      cacheExists: true,
      entryFound: true,
    });

    // The visible, accessible sign-out control.
    await clickVisibleSignOut(page);

    // The app navigates to /login after the device-data teardown completed.
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
    await expect(page.getByLabel('Email Address')).toBeVisible();

    // A failed teardown would land on /login?cleanup=failed (the app's own
    // signal that the purge did not complete). The purge must not be
    // reported as failed.
    expect(page.url()).not.toContain('cleanup=failed');

    // Every seeded user-specific row is gone from IndexedDB.
    await expect
      .poll(async () => readSeededRowPresence(page), {
        timeout: 20000,
        message: 'The seeded device-local rows must be gone after sign-out',
      })
      .toEqual({
        annotations: 0,
        readingInsights: 0,
        feedbackDrafts: 0,
        bookFiles: 0,
      });

    // The whole stores are empty, not only the seeded rows.
    await expect
      .poll(async () => readStoreCounts(page), {
        timeout: 20000,
        message: 'The device-local stores must be empty after sign-out',
      })
      .toEqual({
        annotations: 0,
        readingInsights: 0,
        feedbackDrafts: 0,
        bookFiles: 0,
      });

    // The book-content cache (and its entry) is gone too.
    await expect
      .poll(async () => readBookContentCacheState(page), {
        timeout: 20000,
        message: 'The book-content cache must be deleted after sign-out',
      })
      .toEqual({ cacheExists: false, entryFound: false });

    // Nothing of the previous book is rendered any more.
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toHaveCount(0);
    await expect(page.locator('[data-epub-content-host]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: BOOK_TITLE })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(BOOK_TITLE);
    expect(await readReaderFrameText(page)).not.toContain(CHAPTER_MARKER);
  });

  test('@pwa offline revisit after sign-out cannot recover the cached book', async ({
    page,
    context,
  }) => {
    await loginAsReader(page, BOOK_SLUG);

    await expect
      .poll(() => readReaderFrameText(page), {
        timeout: 30000,
        message: 'The reader must render the book before sign-out',
      })
      .toContain(CHAPTER_MARKER);

    await expect
      .poll(async () => (await readStoreCounts(page)).bookFiles, {
        timeout: 20000,
        message: 'The app must cache the signed book-file URL before sign-out',
      })
      .toBeGreaterThanOrEqual(1);

    await seedDeviceRows(page);
    expect(await readSeededRowPresence(page)).toEqual({
      annotations: 1,
      readingInsights: 1,
      feedbackDrafts: 1,
      bookFiles: 1,
    });
    await seedBookContentCache(page);
    expect(await readBookContentCacheState(page)).toEqual({
      cacheExists: true,
      entryFound: true,
    });

    // Sign out while the page is still uncontrolled, so the mocked logout
    // endpoint answers the request (a controlling worker bypasses the route
    // mocks entirely).
    await clickVisibleSignOut(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });

    await expect
      .poll(async () => readSeededRowPresence(page), {
        timeout: 20000,
        message: 'The seeded device-local rows must be gone after sign-out',
      })
      .toEqual({
        annotations: 0,
        readingInsights: 0,
        feedbackDrafts: 0,
        bookFiles: 0,
      });
    await expect
      .poll(async () => readStoreCounts(page), {
        timeout: 20000,
        message: 'The device-local stores must be empty after sign-out',
      })
      .toEqual({
        annotations: 0,
        readingInsights: 0,
        feedbackDrafts: 0,
        bookFiles: 0,
      });
    await expect
      .poll(async () => readBookContentCacheState(page), {
        timeout: 20000,
        message: 'The book-content cache must be deleted after sign-out',
      })
      .toEqual({ cacheExists: false, entryFound: false });

    // The service worker must be active before the offline revisit, otherwise
    // the offline navigation would fail for the wrong reason. The dev server
    // does not build a worker, so this lane needs the built app.
    // The worker must be installed AND activated before the controlled
    // reload below: registerType 'prompt' ships no clients.claim, so only
    // pages loaded after activation are controlled. The lane needs
    // PLAYWRIGHT_MODE=preview; the dev server ships no worker.
    await waitForServiceWorkerActivation(page);

    // registerType 'prompt' ships no clients.claim: only pages loaded after
    // activation are controlled. Reload, then wait for control.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 30000,
        message: 'Service Worker must control the page in pwa-chromium',
      })
      .toBe(true);

    await context.setOffline(true);
    await page.goto(`/read/${BOOK_SLUG}`);

    // The signed-out reader cannot render the previous book offline.
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
    await expect(page.locator('[data-epub-content-host]')).toHaveCount(0);
    expect(await readReaderFrameText(page)).not.toContain(CHAPTER_MARKER);
    await expect(page.locator('body')).not.toContainText(BOOK_TITLE);

    // The purged cache entry is not servable any more: the worker cannot hand
    // the book bytes back from `book-content`.
    const swDelivery = await page.evaluate(
      async ({ url, bytes }) => {
        const seeded = new Uint8Array(bytes);
        try {
          const response = await fetch(url);
          const received = new Uint8Array(await response.arrayBuffer());
          const identical =
            received.length === seeded.length &&
            received.every((byte, index) => byte === seeded[index]);
          return { failed: false, identical };
        } catch {
          return { failed: true, identical: false };
        }
      },
      { url: BOOK_FILE_CACHE_PATH, bytes: Array.from(EPUB_BUFFER) },
    );
    expect(
      swDelivery.identical,
      'the purged book-content entry must not be served offline after sign-out',
    ).toBe(false);

    await context.setOffline(false);
  });
});
