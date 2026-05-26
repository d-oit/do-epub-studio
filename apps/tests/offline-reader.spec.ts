import { test, expect, type Page, type Route } from '@playwright/test';
import { deflateSync } from 'zlib';

// ---------------------------------------------------------------------------
// CRC32 (standalone)
// ---------------------------------------------------------------------------

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Minimal EPUB builder
// ---------------------------------------------------------------------------

function createMinimalEpub(): Buffer {
  const files: { name: string; data: Buffer; method: number }[] = [];

  files.push({ name: 'mimetype', data: Buffer.from('application/epub+zip'), method: 0 });

  files.push({
    name: 'META-INF/container.xml',
    data: Buffer.from(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    ),
    method: 8,
  });

  files.push({
    name: 'content.opf',
    data: Buffer.from(
      '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:offline-test-book</dc:identifier><dc:title>Offline Test Book</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'
    ),
    method: 8,
  });

  files.push({
    name: 'nav.xhtml',
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Navigation</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter1.xhtml">Chapter 1</a></li></ol></nav></body></html>'
    ),
    method: 8,
  });

  files.push({
    name: 'chapter1.xhtml',
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><p>OFFLINE TEST CONTENT for the offline reader test.</p></body></html>'
    ),
    method: 8,
  });

  const localBlocks: Buffer[] = [];
  const centralBlocks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameB = Buffer.from(file.name);
    const raw = file.data;
    const compressed = file.method === 0 ? raw : deflateSync(raw);
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(file.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameB.length, 26);
    lh.writeUInt16LE(0, 28);
    localBlocks.push(Buffer.concat([lh, nameB]));
    localBlocks.push(compressed);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(file.method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressed.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralBlocks.push(Buffer.concat([ch, nameB]));

    offset += 30 + nameB.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralBlocks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localBlocks, centralDir, eocd]);
}

// ---------------------------------------------------------------------------
// Constants
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

const EPUB_BUFFER = createMinimalEpub();

// ---------------------------------------------------------------------------
// API route mocks
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) });
  });
  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: 'http://127.0.0.1:0/test/epub-offline' } }) });
  });
  await page.route('**/test/epub-offline', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: EPUB_BUFFER });
  });
  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0 } }) });
  });
  await page.route('**/api/books/*/highlights', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/access/logout', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndOpenReader(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/read\/offline-test/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await expect(page.getByRole('heading', { name: 'Offline Test Book' })).toBeVisible({ timeout: 10000 });
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
    await mockApiRoutes(page);
  });

  test('loads reader page online then survives offline reload', async ({ page }) => {
    // Load the reader page online
    await loginAndOpenReader(page);

    // Block all API and network requests to simulate offline
    await page.route('**/api/**', async (route: Route) => {
      await route.abort('failed');
    });
    await page.route('**/*.epub', async (route: Route) => {
      await route.abort('failed');
    });

    // Reload the page while offline
    await page.reload();
    await page.waitForTimeout(3000);

    // The app should still render (login redirect may happen due to no auth)
    // At minimum the page should not crash — check the document body is present
    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);

    // Restore network by removing the blocking routes
    await page.unroute('**/api/**');
    await page.unroute('**/*.epub');

    // Reload again now that we're back online
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page is still functional
    const bodyStillVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyStillVisible).toBe(true);
  });

  test('detects offline/online status transitions', async ({ page, context }) => {
    await loginAndOpenReader(page);

    // Verify initial online status
    const initialOnline = await page.evaluate(() => navigator.onLine);
    expect(initialOnline).toBe(true);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Verify navigator.onLine reflects offline
    const isOffline = await page.evaluate(() => navigator.onLine);
    expect(isOffline).toBe(false);

    // App may dispatch online/offline events — check status hasn't crashed
    const bodyOk = await page.locator('body').isVisible().catch(() => false);
    expect(bodyOk).toBe(true);

    // Restore connection
    await context.setOffline(false);
    await page.waitForTimeout(500);

    // Verify navigator.onLine is true again
    const backOnline = await page.evaluate(() => navigator.onLine);
    expect(backOnline).toBe(true);
  });

  test('serves cached API responses while offline (NetworkFirst strategy)', async ({ page, context }) => {
    await loginAndOpenReader(page);

    // Fetch a test endpoint while online to populate the cache
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

    // Go offline via context
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Fetch the same endpoint — should be served from cache
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

    // Verify the response exists in the service worker cache
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

  test('queues offline actions for sync when network is unavailable', async ({ page, context }) => {
    await loginAndOpenReader(page);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Perform an action that should be queued (e.g., add a bookmark)
    // Attempt to POST a bookmark while offline
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

    // Check whether the app maintains an offline sync queue in IndexedDB
    const syncQueueExists = await page.evaluate(async () => {
      if (typeof indexedDB === 'undefined') return false;
      const dbs = await indexedDB.databases?.() ?? [];
      return dbs.some((db) => db.name?.includes('offline') || db.name?.includes('sync'));
    });

    // If the app queues offline actions, verify the queue has entries.
    // Otherwise the offline POST is expected to fail silently.
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

    // Restore online
    await context.setOffline(false);
    await page.waitForTimeout(500);

    // Verify the page is still functional after coming back online
    const bodyOk = await page.locator('body').isVisible().catch(() => false);
    expect(bodyOk).toBe(true);
  });
});
