import { test, expect, type Page, type Route, type Request } from '@playwright/test';
import { decryptJSON } from '../web/src/lib/offline/crypto';
import {
  createMinimalEpub,
  loginAsReader,
  mockReaderApi,
  selectReaderPassage,
  suppressWorkboxErrors,
} from './fixtures';

// ---------------------------------------------------------------------------
// Helpers & Types
// ---------------------------------------------------------------------------

interface ServerCommentDTO {
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
  mutationId?: string;
}

interface CommentCreateRequest {
  mutationId?: string;
  locator?: { chapterRef: string; cfi: string; selectedText: string };
  body: string;
  visibility?: string;
}

interface StoredOfflineDatabase {
  annotations: Record<string, unknown>[];
  queue: Record<string, unknown>[];
  progress: Record<string, unknown>[];
}

function createLoginResponse(slug: string) {
  return {
    ok: true,
    data: {
      sessionToken: `test-session-token-${slug}`,
      book: {
        id: `book-${slug}`,
        slug,
        title: `Test Book ${slug}`,
        authorName: 'Test Author',
      },
      capabilities: {
        canRead: true,
        canComment: true,
        canHighlight: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: false,
      },
    },
  };
}

async function readOfflineDatabase(page: Page): Promise<StoredOfflineDatabase> {
  return page.evaluate(async () => {
    const request = indexedDB.open('do-epub-studio', 5);
    return new Promise<StoredOfflineDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => {
        const db = request.result;
        const stores = ['annotations', 'syncQueue', 'progress'];
        const existingStores = stores.filter((s) => db.objectStoreNames.contains(s));
        if (existingStores.length === 0) {
          db.close();
          resolve({ annotations: [], queue: [], progress: [] });
          return;
        }
        const tx = db.transaction(existingStores, 'readonly');
        const annotations = db.objectStoreNames.contains('annotations')
          ? tx.objectStore('annotations').getAll()
          : null;
        const queue = db.objectStoreNames.contains('syncQueue')
          ? tx.objectStore('syncQueue').getAll()
          : null;
        const progress = db.objectStoreNames.contains('progress')
          ? tx.objectStore('progress').getAll()
          : null;

        tx.oncomplete = () => {
          db.close();
          resolve({
            annotations: (annotations?.result as Record<string, unknown>[]) ?? [],
            queue: (queue?.result as Record<string, unknown>[]) ?? [],
            progress: (progress?.result as Record<string, unknown>[]) ?? [],
          });
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
      };
    });
  });
}

async function decryptQueueItems(
  queue: Record<string, unknown>[],
  sessionToken: string,
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    queue.map((item) => {
      if (typeof item.encryptedPayload !== 'string') {
        return Promise.resolve(item);
      }
      return decryptJSON<Record<string, unknown>>(item.encryptedPayload, sessionToken);
    }),
  );
}

async function getChapterText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const texts = iframes.map(
      (f) =>
        f.contentDocument?.body?.textContent ?? f.contentWindow?.document?.body?.textContent ?? '',
    );
    return (
      texts.join(' ') ||
      (document.querySelector('div[data-reader-viewer="true"]')?.textContent ?? '')
    );
  });
}

// ---------------------------------------------------------------------------
// Offline Sync & Annotation Conflicts Test Suite
// ---------------------------------------------------------------------------

test.describe('Offline Sync & Annotation Conflicts (@pwa)', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    suppressWorkboxErrors(page);
  });

  test('@pwa two-client divergence: offline edits in client A and online edits in client B converge deterministically', async ({
    browser,
  }) => {
    const bookSlug = 'sync-conflict-divergence';
    const loginResponse = createLoginResponse(bookSlug);
    const epubBuffer = createMinimalEpub(
      [
        {
          id: 'c1',
          href: 'chapter1.xhtml',
          title: 'Chapter 1',
          body: '<p>TWO CLIENT DIVERGENCE PASSAGE for sync test.</p>',
        },
      ],
      { title: 'Divergence Book', identifier: 'urn:uuid:divergence-book' },
    );
    const epubUrl = `http://127.0.0.1:0/test/${bookSlug}.epub`;

    const sharedComments: ServerCommentDTO[] = [];
    const seenMutations = new Set<string>();

    async function handleCommentsRoute(
      route: Route,
      request: Request,
      isOffline: boolean,
    ): Promise<void> {
      if (isOffline) {
        await route.abort('internetdisconnected');
        return;
      }

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: sharedComments }),
        });
        return;
      }

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as CommentCreateRequest;
        const mutationId = body.mutationId ?? `anon-cm-${Date.now()}`;
        let match = sharedComments.find((c) => c.mutationId === mutationId);
        if (!match && !seenMutations.has(mutationId)) {
          seenMutations.add(mutationId);
          const now = new Date().toISOString();
          match = {
            id: `server-cm-${sharedComments.length + 1}`,
            displayName: 'reader',
            isOwn: true,
            chapterRef: body.locator?.chapterRef ?? 'chapter1.xhtml',
            cfiRange: body.locator?.cfi ?? 'epubcfi(/6/4)',
            selectedText: body.locator?.selectedText ?? 'TWO CLIENT DIVERGENCE PASSAGE',
            body: body.body,
            status: 'open',
            visibility: body.visibility ?? 'shared',
            parentCommentId: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            mutationId,
          };
          sharedComments.push(match);
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: match }),
        });
        return;
      }

      await route.fallback();
    }

    // Create two isolated browser contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    let isOfflineA = false;
    const isOfflineB = false;

    await mockReaderApi(contextA, {
      bookSlug,
      epubUrl,
      epubBuffer,
      loginResponse,
      includeFeedback: true,
    });
    await mockReaderApi(contextB, {
      bookSlug,
      epubUrl,
      epubBuffer,
      loginResponse,
      includeFeedback: true,
    });

    await contextA.route('**/api/books/*/comments', (route, request) =>
      handleCommentsRoute(route, request, isOfflineA),
    );
    await contextB.route('**/api/books/*/comments', (route, request) =>
      handleCommentsRoute(route, request, isOfflineB),
    );

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    suppressWorkboxErrors(pageA);
    suppressWorkboxErrors(pageB);

    // Login both clients to the same book
    await loginAsReader(pageA, bookSlug);
    await loginAsReader(pageB, bookSlug);

    await expect
      .poll(() => getChapterText(pageA), { timeout: 30000 })
      .toContain('DIVERGENCE PASSAGE');
    await expect
      .poll(() => getChapterText(pageB), { timeout: 30000 })
      .toContain('DIVERGENCE PASSAGE');

    // Context A goes offline and creates a comment
    isOfflineA = true;
    await contextA.setOffline(true);

    await selectReaderPassage(pageA, 'TWO CLIENT DIVERGENCE PASSAGE');
    await pageA
      .locator('button')
      .filter({ hasText: /^Comment$/ })
      .click();
    const modalA = pageA.getByRole('dialog', { name: 'Comment' });
    await expect(modalA).toBeVisible();
    await modalA.getByRole('textbox').fill('Offline comment from Client A');
    await modalA.getByRole('button', { name: 'Comment' }).click();
    await expect(modalA).not.toBeVisible();

    // Verify Context A queued the comment locally
    const idbA = await readOfflineDatabase(pageA);
    expect(
      idbA.queue.length,
      'Client A should have at least 1 queued action offline',
    ).toBeGreaterThanOrEqual(1);

    // Context B remains online and creates a competing comment
    await selectReaderPassage(pageB, 'TWO CLIENT DIVERGENCE PASSAGE');
    await pageB
      .locator('button')
      .filter({ hasText: /^Comment$/ })
      .click();
    const modalB = pageB.getByRole('dialog', { name: 'Comment' });
    await expect(modalB).toBeVisible();
    await modalB.getByRole('textbox').fill('Online comment from Client B');
    await modalB.getByRole('button', { name: 'Comment' }).click();
    await expect(modalB).not.toBeVisible();

    // Verify server has received Client B's comment
    await expect.poll(() => sharedComments.length, { timeout: 15000 }).toBe(1);
    expect(sharedComments[0]?.body).toBe('Online comment from Client B');

    // Context A reconnects
    isOfflineA = false;
    await contextA.setOffline(false);

    // Context A flushes queue and syncs its offline comment to the server
    await expect
      .poll(() => sharedComments.length, {
        timeout: 20000,
        message: 'Server should hold comments from both Client B and Client A after reconnect',
      })
      .toBe(2);

    const commentBodies = sharedComments.map((c) => c.body);
    expect(commentBodies).toContain('Online comment from Client B');
    expect(commentBodies).toContain('Offline comment from Client A');

    // Verify no duplicate mutation IDs exist
    const mutationIds = sharedComments.map((c) => c.mutationId);
    expect(new Set(mutationIds).size).toBe(2);

    // Verify Context A's annotation sync items have drained
    await expect
      .poll(
        async () => {
          const db = await readOfflineDatabase(pageA);
          const queue = await decryptQueueItems(db.queue, loginResponse.data.sessionToken);
          return queue.filter((item) => item.type === 'annotation').length;
        },
        { timeout: 15000 },
      )
      .toBe(0);

    await contextA.close();
    await contextB.close();
  });

  test('@pwa two tabs: Web Locks serialize drains without duplicate mutations', async ({
    browser,
  }) => {
    const bookSlug = 'sync-two-tab-single-flight';
    const loginResponse = createLoginResponse(bookSlug);
    const epubBuffer = createMinimalEpub(
      [
        {
          id: 'c1',
          href: 'chapter1.xhtml',
          title: 'Chapter 1',
          body: '<p>TWO TAB SINGLE FLIGHT PASSAGE for sync test.</p>',
        },
      ],
      { title: 'Two Tab Sync Book', identifier: 'urn:uuid:two-tab-sync' },
    );
    const epubUrl = `http://127.0.0.1:0/test/${bookSlug}.epub`;
    const comments: ServerCommentDTO[] = [];
    const mutationRequests = new Map<string, number>();
    let offline = false;
    let releaseFirstPost: (() => void) | undefined;
    let markFirstPostStarted: (() => void) | undefined;
    const firstPostGate = new Promise<void>((resolve) => {
      releaseFirstPost = resolve;
    });
    const firstPostStarted = new Promise<void>((resolve) => {
      markFirstPostStarted = resolve;
    });

    const context = await browser.newContext();
    await mockReaderApi(context, {
      bookSlug,
      epubUrl,
      epubBuffer,
      loginResponse,
      includeFeedback: true,
    });
    await context.route('**/api/books/*/comments', async (route, request) => {
      if (offline) {
        await route.abort('internetdisconnected');
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: comments }),
        });
        return;
      }
      if (request.method() !== 'POST') {
        await route.fallback();
        return;
      }

      const payload: unknown = request.postDataJSON();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('body' in payload) ||
        typeof payload.body !== 'string'
      ) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'Invalid comment request' }),
        });
        return;
      }

      const mutationId =
        'mutationId' in payload && typeof payload.mutationId === 'string'
          ? payload.mutationId
          : `anon-cm-${Date.now()}`;
      const locator =
        'locator' in payload && typeof payload.locator === 'object' && payload.locator !== null
          ? payload.locator
          : null;
      const chapterRef =
        locator && 'chapterRef' in locator && typeof locator.chapterRef === 'string'
          ? locator.chapterRef
          : null;
      const cfiRange =
        locator && 'cfi' in locator && typeof locator.cfi === 'string' ? locator.cfi : null;
      const selectedText =
        locator && 'selectedText' in locator && typeof locator.selectedText === 'string'
          ? locator.selectedText
          : null;
      const visibility =
        'visibility' in payload && typeof payload.visibility === 'string'
          ? payload.visibility
          : 'shared';
      const count = (mutationRequests.get(mutationId) ?? 0) + 1;
      mutationRequests.set(mutationId, count);
      if (count === 1 && mutationRequests.size === 1) {
        markFirstPostStarted?.();
        await firstPostGate;
      }

      const existing = comments.find((comment) => comment.mutationId === mutationId);
      const comment = existing ?? {
        id: `server-cm-${comments.length + 1}`,
        displayName: 'reader',
        isOwn: true,
        chapterRef,
        cfiRange,
        selectedText,
        body: payload.body,
        status: 'open',
        visibility,
        parentCommentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        mutationId,
      };
      if (!existing) comments.push(comment);

      await route.fulfill({
        status: existing ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: comment }),
      });
    });

    const pageA = await context.newPage();
    const pageB = await context.newPage();
    suppressWorkboxErrors(pageA);
    suppressWorkboxErrors(pageB);

    try {
      await loginAsReader(pageA, bookSlug);
      await loginAsReader(pageB, bookSlug);
      await expect.poll(() => getChapterText(pageA), { timeout: 30000 }).toContain('SINGLE FLIGHT');
      await expect.poll(() => getChapterText(pageB), { timeout: 30000 }).toContain('SINGLE FLIGHT');

      offline = true;
      await context.setOffline(true);
      const offlineComments = [
        { page: pageA, commentText: 'Offline comment from tab A' },
        { page: pageB, commentText: 'Offline comment from tab B' },
      ];
      for (const { page, commentText } of offlineComments) {
        await selectReaderPassage(page, 'TWO TAB SINGLE FLIGHT PASSAGE');
        await page
          .locator('button')
          .filter({ hasText: /^Comment$/ })
          .click();
        const modal = page.getByRole('dialog', { name: 'Comment' });
        await expect(modal).toBeVisible();
        await modal.getByRole('textbox').fill(commentText);
        await modal.getByRole('button', { name: 'Comment' }).click();
        await expect(modal).not.toBeVisible();
      }

      await expect
        .poll(
          async () => {
            const database = await readOfflineDatabase(pageA);
            const queue = await decryptQueueItems(database.queue, loginResponse.data.sessionToken);
            return queue.filter((item) => item.type === 'annotation').length;
          },
          { timeout: 10000 },
        )
        .toBe(2);

      offline = false;
      await context.setOffline(false);
      await firstPostStarted;
      await expect
        .poll(
          async () =>
            pageA.evaluate(
              async () =>
                (await navigator.locks.query()).pending.filter(
                  (lock) => lock.name === 'offline-sync-queue',
                ).length,
            ),
          {
            timeout: 10000,
            message: 'The second tab should wait for the active cross-tab sync lock',
          },
        )
        .toBeGreaterThan(0);

      releaseFirstPost?.();
      await expect.poll(() => comments.length, { timeout: 20000 }).toBe(2);
      expect(mutationRequests.size).toBe(2);
      expect([...mutationRequests.values()]).toEqual([1, 1]);
      expect(comments.map((comment) => comment.body)).toEqual(
        expect.arrayContaining(['Offline comment from tab A', 'Offline comment from tab B']),
      );
    } finally {
      releaseFirstPost?.();
      await context.close();
    }
  });

  test('@pwa interrupted sync: offline queued mutations retry after initial failure and settle exactly once', async ({
    page,
    context,
  }) => {
    const bookSlug = 'sync-conflict-interrupted';
    const loginResponse = createLoginResponse(bookSlug);
    const epubBuffer = createMinimalEpub(
      [
        {
          id: 'c1',
          href: 'chapter1.xhtml',
          title: 'Chapter 1',
          body: '<p>INTERRUPTED SYNC TEST PASSAGE</p>',
        },
      ],
      { title: 'Interrupted Sync Book', identifier: 'urn:uuid:interrupted-book' },
    );
    const epubUrl = `http://127.0.0.1:0/test/${bookSlug}.epub`;

    let shouldFailFirst = false;
    let failedAttempts = 0;

    const acceptedComments: ServerCommentDTO[] = [];
    const seenMutations = new Set<string>();

    await mockReaderApi(context, {
      bookSlug,
      epubUrl,
      epubBuffer,
      loginResponse,
      includeFeedback: true,
    });

    await context.route('**/api/books/*/comments', async (route: Route, request: Request) => {
      if (request.method() === 'POST') {
        if (shouldFailFirst) {
          shouldFailFirst = false;
          failedAttempts++;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: { code: 'SERVICE_UNAVAILABLE', message: 'Simulated sync interruption' },
            }),
          });
          return;
        }

        const body = request.postDataJSON() as CommentCreateRequest;
        const mutationId = body.mutationId ?? `anon-cm-${Date.now()}`;
        let match = acceptedComments.find((c) => c.mutationId === mutationId);
        if (!match && !seenMutations.has(mutationId)) {
          seenMutations.add(mutationId);
          const now = new Date().toISOString();
          match = {
            id: `server-cm-${acceptedComments.length + 1}`,
            displayName: 'reader',
            isOwn: true,
            chapterRef: body.locator?.chapterRef ?? 'chapter1.xhtml',
            cfiRange: body.locator?.cfi ?? 'epubcfi(/6/4)',
            selectedText: body.locator?.selectedText ?? 'INTERRUPTED SYNC TEST PASSAGE',
            body: body.body,
            status: 'open',
            visibility: body.visibility ?? 'shared',
            parentCommentId: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            mutationId,
          };
          acceptedComments.push(match);
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: match }),
        });
        return;
      }

      await route.fallback();
    });

    await loginAsReader(page, bookSlug);
    await expect.poll(() => getChapterText(page), { timeout: 30000 }).toContain('INTERRUPTED SYNC');

    await context.setOffline(true);

    // Queue 5 offline annotations directly into IndexedDB syncQueue (sealed format)
    await page.evaluate(async (slug) => {
      const DB_NAME = 'do-epub-studio';
      const STORE_NAME = 'syncQueue';
      const authRaw = globalThis.localStorage.getItem('do-epub-auth');
      const sessionToken: string | undefined = authRaw
        ? (JSON.parse(authRaw) as { state?: { sessionToken?: string } }).state?.sessionToken
        : undefined;
      if (!sessionToken) throw new Error('Seeding needs session token');

      function toBase64(bytes: Uint8Array): string {
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
      }

      async function encryptJSON(value: unknown, token: string): Promise<string> {
        const subtle = globalThis.crypto.subtle;
        const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = await subtle.importKey(
          'raw',
          new TextEncoder().encode(token),
          { name: 'PBKDF2' },
          false,
          ['deriveKey'],
        );
        const key = await subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt'],
        );
        const sealed = new Uint8Array(
          await subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(JSON.stringify(value)),
          ),
        );
        const combined = new Uint8Array(16 + 12 + sealed.length);
        combined.set(salt, 0);
        combined.set(iv, 16);
        combined.set(sealed, 28);
        return toBase64(combined);
      }

      const items = Array.from({ length: 5 }, (_, i) => {
        const mutationId = crypto.randomUUID();
        return {
          id: crypto.randomUUID(),
          type: 'annotation',
          payload: {
            bookId: `book-${slug}`,
            annotation: {
              type: 'comment',
              cfi: `epubcfi(/6/${(i + 1) * 2})`,
              chapter: 'chapter1.xhtml',
              text: 'INTERRUPTED SYNC TEST PASSAGE',
              comment: `Queued comment ${i + 1}`,
            },
            action: 'create',
          },
          mutationId,
          createdAt: Date.now() + i,
          attempts: 0,
        };
      });

      const sealedItems = await Promise.all(
        items.map(async ({ id, createdAt, ...rest }) => ({
          id,
          createdAt,
          encryptedPayload: await encryptJSON(rest, sessionToken),
        })),
      );

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 5);
        req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          for (const item of sealedItems) store.put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
        };
      });
    }, bookSlug);

    const idbBefore = await readOfflineDatabase(page);
    expect(idbBefore.queue.length).toBeGreaterThanOrEqual(5);

    // Reconnect with `shouldFailFirst = true` so the first POST returns 503
    shouldFailFirst = true;
    await context.setOffline(false);

    // Wait for all 5 comments to settle on the server
    await expect
      .poll(() => acceptedComments.length, {
        timeout: 25000,
        message: 'All 5 queued annotations should eventually sync successfully',
      })
      .toBe(5);

    expect(failedAttempts, 'First request should have failed with 503').toBe(1);

    // Verify all 5 accepted comments have distinct mutation IDs and zero duplicates
    const mutationIds = acceptedComments.map((c) => c.mutationId);
    expect(new Set(mutationIds).size).toBe(5);

    // Verify IndexedDB syncQueue has zero queued annotation items remaining
    await expect
      .poll(
        async () => {
          const db = await readOfflineDatabase(page);
          const queue = await decryptQueueItems(db.queue, loginResponse.data.sessionToken);
          return queue.filter((item) => item.type === 'annotation').length;
        },
        {
          timeout: 20000,
          message: 'Queued annotation items should be completely drained after retry recovery',
        },
      )
      .toBe(0);
  });

  test('@pwa reload while offline: restores cached EPUB, last-read CFI position, and pending annotations', async ({
    page,
    context,
  }) => {
    const bookSlug = 'sync-conflict-reload';
    const loginResponse = createLoginResponse(bookSlug);
    const epubBuffer = createMinimalEpub(
      [
        {
          id: 'c1',
          href: 'chapter1.xhtml',
          title: 'Chapter 1',
          body: '<p>CHAPTER ONE RELOAD CONTENT</p>',
        },
        {
          id: 'c2',
          href: 'chapter2.xhtml',
          title: 'Chapter 2',
          body: '<p>CHAPTER TWO RELOAD CONTENT</p>',
        },
      ],
      { title: 'Reload Book', identifier: 'urn:uuid:reload-book' },
    );
    const epubUrl = `http://127.0.0.1:0/test/${bookSlug}.epub`;

    let isOfflineNetwork = false;
    const acceptedComments: ServerCommentDTO[] = [];

    await mockReaderApi(context, {
      bookSlug,
      epubUrl,
      epubBuffer,
      loginResponse,
      includeFeedback: true,
    });

    await context.route('**/api/books/*/comments', async (route: Route, request: Request) => {
      if (isOfflineNetwork) {
        await route.abort('internetdisconnected');
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: acceptedComments }),
        });
        return;
      }
      await route.fallback();
    });

    await context.route('**/api/**', async (route: Route) => {
      if (isOfflineNetwork) {
        await route.abort('internetdisconnected');
        return;
      }
      await route.fallback();
    });

    await loginAsReader(page, bookSlug);
    await expect
      .poll(() => getChapterText(page), { timeout: 30000 })
      .toContain('CHAPTER ONE RELOAD');

    // Reload online once to acquire SW control and seed external-assets SW cache
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
        { timeout: 15000, message: 'Service Worker must control the page' },
      )
      .toBe(true);

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
      { url: epubUrl, bytes: Array.from(epubBuffer) },
    );

    // Go offline
    isOfflineNetwork = true;
    await context.setOffline(true);

    // Create an offline comment
    await selectReaderPassage(page, 'CHAPTER ONE RELOAD CONTENT');
    await page
      .locator('button')
      .filter({ hasText: /^Comment$/ })
      .click();
    const modal = page.getByRole('dialog', { name: 'Comment' });
    await expect(modal).toBeVisible();
    await modal.getByRole('textbox').fill('Offline comment before reload');
    await modal.getByRole('button', { name: 'Comment' }).click();
    await expect(modal).not.toBeVisible();

    // Store last-read CFI position in IndexedDB progress store pointing to Chapter 2
    const testCfi = 'epubcfi(/6/4!/4/2)';
    await page.evaluate(
      async ({ slug, cfi }) => {
        const DB_NAME = 'do-epub-studio';
        const STORE_NAME = 'progress';
        const authRaw = globalThis.localStorage.getItem('do-epub-auth');
        const sessionToken: string | undefined = authRaw
          ? (JSON.parse(authRaw) as { state?: { sessionToken?: string } }).state?.sessionToken
          : undefined;
        if (!sessionToken) throw new Error('Seeding progress needs session token');

        function toBase64(bytes: Uint8Array): string {
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          return btoa(binary);
        }

        async function encryptJSON(value: unknown, token: string): Promise<string> {
          const subtle = globalThis.crypto.subtle;
          const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
          const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
          const keyMaterial = await subtle.importKey(
            'raw',
            new TextEncoder().encode(token),
            { name: 'PBKDF2' },
            false,
            ['deriveKey'],
          );
          const key = await subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt'],
          );
          const sealed = new Uint8Array(
            await subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              new TextEncoder().encode(JSON.stringify(value)),
            ),
          );
          const combined = new Uint8Array(16 + 12 + sealed.length);
          combined.set(salt, 0);
          combined.set(iv, 16);
          combined.set(sealed, 28);
          return toBase64(combined);
        }

        const progressEntry = {
          id: `progress-book-${slug}`,
          bookId: `book-${slug}`,
          cfi,
          percentage: 0.5,
          lastRead: Date.now(),
          synced: false,
        };

        const encrypted = await encryptJSON(
          {
            cfi: progressEntry.cfi,
            percentage: progressEntry.percentage,
            lastRead: progressEntry.lastRead,
          },
          sessionToken,
        );

        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, 5);
          req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({
              id: progressEntry.id,
              bookId: progressEntry.bookId,
              synced: progressEntry.synced,
              encryptedPayload: encrypted,
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
          };
        });
      },
      { slug: bookSlug, cfi: testCfi },
    );

    // Hard-reload the page while offline
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify EPUB content is rendered from SW / IndexedDB cache (renders Chapter 2 / Chapter 1)
    await expect.poll(() => getChapterText(page), { timeout: 30000 }).toContain('RELOAD CONTENT');

    // Verify pending annotation survived reload in IndexedDB and UI
    const commentsButton = page.getByRole('button', { name: /^Comments/ });
    await commentsButton.focus();
    await page.keyboard.press('Enter');
    const commentsPanel = page.locator('aside');
    await expect(commentsPanel.getByText('Offline comment before reload')).toBeVisible();
    await expect(commentsPanel.getByRole('status')).toContainText('Pending sync');

    // Verify last-read CFI position survived reload in IndexedDB
    const idbDump = await readOfflineDatabase(page);
    expect(
      idbDump.progress.length,
      'Progress entry should exist after offline reload',
    ).toBeGreaterThanOrEqual(1);
    expect(idbDump.annotations.length, 'Annotation record should exist after offline reload').toBe(
      1,
    );
    expect(
      idbDump.queue.length,
      'Sync queue item should exist after offline reload',
    ).toBeGreaterThanOrEqual(1);
  });
});
