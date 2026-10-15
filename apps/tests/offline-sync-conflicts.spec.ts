import { test, expect, type Page, type Request, type Route } from '@playwright/test';
import { decryptJSON } from '../web/src/lib/offline/crypto';
import {
  createMinimalEpub,
  loginAsReader,
  mockReaderApi,
  selectReaderPassage,
  suppressWorkboxErrors,
  waitForServiceWorkerActivation,
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
  body?: string;
  visibility?: string;
}

interface StoredOfflineDatabase {
  annotations: Record<string, unknown>[];
  queue: Record<string, unknown>[];
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
        const stores = ['annotations', 'syncQueue'];
        const existingStores = stores.filter((store) => db.objectStoreNames.contains(store));
        if (existingStores.length === 0) {
          db.close();
          resolve({ annotations: [], queue: [] });
          return;
        }
        const tx = db.transaction(existingStores, 'readonly');
        const annotations = db.objectStoreNames.contains('annotations')
          ? tx.objectStore('annotations').getAll()
          : null;
        const queue = db.objectStoreNames.contains('syncQueue')
          ? tx.objectStore('syncQueue').getAll()
          : null;

        tx.oncomplete = () => {
          db.close();
          resolve({
            annotations: (annotations?.result as Record<string, unknown>[]) ?? [],
            queue: (queue?.result as Record<string, unknown>[]) ?? [],
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
    suppressWorkboxErrors(page);
  });

  test('@pwa two-client divergence: offline edits in client A and online edits in client B converge deterministically', async ({
    browser,
  }, testInfo) => {
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
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string') throw new Error('Playwright project baseURL is required');
    const epubUrl = new URL(`/api/files/${bookSlug}.epub`, baseURL).toString();

    const sharedComments: ServerCommentDTO[] = [];
    const seenMutations = new Set<string>();

    async function handleCommentsRoute(route: Route, request: Request, isOffline: boolean) {
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
        if (!body.mutationId || !body.body) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR' } }),
          });
          return;
        }
        const mutationId = body.mutationId;
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
    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });
    try {
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
      const commentsButtonA = pageA.getByRole('button', { name: /^Comments/ });
      await commentsButtonA.focus();
      await commentsButtonA.press('Enter');
      const commentsPanelA = pageA.locator('aside');
      await expect(commentsPanelA.getByText('Offline comment from Client A')).toBeVisible();
      await expect(commentsPanelA.getByRole('status')).toHaveCount(0);
      await Promise.all([
        pageA.reload({ waitUntil: 'domcontentloaded' }),
        pageB.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      async function expectConvergedComments(page: Page) {
        await expect
          .poll(() => getChapterText(page), { timeout: 30_000 })
          .toContain('DIVERGENCE PASSAGE');
        const commentsButton = page.getByRole('button', { name: /^Comments/ });
        await commentsButton.focus();
        await commentsButton.press('Enter');
        const panel = page.locator('aside');
        await expect(panel.getByText('Offline comment from Client A')).toBeVisible();
        await expect(panel.getByText('Online comment from Client B')).toBeVisible();
      }
      await Promise.all([expectConvergedComments(pageA), expectConvergedComments(pageB)]);
    } finally {
      await Promise.all([contextA.close(), contextB.close()]);
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
    const epubUrl = `/test/${bookSlug}.epub`;

    let shouldFailFirst = false;
    let isOfflineNetwork = false;
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

    const postMutationAttempts: string[] = [];
    await context.route('**/api/books/*/comments', async (route: Route, request: Request) => {
      if (isOfflineNetwork) {
        await route.abort('internetdisconnected');
        return;
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as CommentCreateRequest;
        if (!body.mutationId || !body.body) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR' } }),
          });
          return;
        }
        postMutationAttempts.push(body.mutationId);
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

        const mutationId = body.mutationId;
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

    isOfflineNetwork = true;
    await context.setOffline(true);

    const expectedBodies = Array.from({ length: 5 }, (_, index) => `Queued comment ${index + 1}`);
    for (const body of expectedBodies) {
      await selectReaderPassage(page, 'INTERRUPTED SYNC TEST PASSAGE');
      await page
        .locator('button')
        .filter({ hasText: /^Comment$/ })
        .click();
      const modal = page.getByRole('dialog', { name: 'Comment' });
      await expect(modal).toBeVisible();
      await modal.getByRole('textbox').fill(body);
      await modal.getByRole('button', { name: 'Comment' }).click();
      await expect(modal).not.toBeVisible();
    }

    await expect(page.getByText('You are offline')).toBeVisible();

    shouldFailFirst = true;
    isOfflineNetwork = false;
    await context.setOffline(false);

    await expect
      .poll(() => acceptedComments.map((comment) => comment.body).sort(), {
        timeout: 25000,
        message: 'All five offline comments should sync after reconnect',
      })
      .toEqual([...expectedBodies].sort());

    expect(failedAttempts, 'First request should have failed with 503').toBe(1);
    expect(postMutationAttempts.length).toBeGreaterThan(5);
    const retriedId = postMutationAttempts[0];
    expect(retriedId).toBeTruthy();
    expect(postMutationAttempts.filter((id) => id === retriedId).length).toBeGreaterThan(1);
    expect(new Set(acceptedComments.map((comment) => comment.mutationId)).size).toBe(5);
    expect(acceptedComments).toHaveLength(5);
    expect(new Set(acceptedComments.map((comment) => comment.body))).toEqual(
      new Set(expectedBodies),
    );
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
  }, testInfo) => {
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
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string') throw new Error('Playwright project baseURL is required');
    const epubUrl = new URL(`/api/files/${bookSlug}.epub`, baseURL).toString();

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

    await waitForServiceWorkerActivation(page);

    // Reload online under service-worker control, then let the reader load the
    // EPUB normally so Workbox's book-content route can populate its cache.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 15000,
        message: 'Service Worker must control the page',
      })
      .toBe(true);
    await expect
      .poll(() => getChapterText(page), { timeout: 30000 })
      .toContain('CHAPTER ONE RELOAD');
    await expect
      .poll(
        () =>
          page.evaluate(async (url) => {
            const cache = await caches.open('book-content');
            return Boolean(await cache.match(url));
          }, epubUrl),
        { timeout: 15000, message: 'Online reader load should cache EPUB in Workbox book-content' },
      )
      .toBe(true);

    // The online load above populated Workbox. Now create progress through an
    // actual offline reader navigation so the app persists its offline CFI.
    isOfflineNetwork = true;
    await context.setOffline(true);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => getChapterText(page), { timeout: 15000 })
      .toContain('CHAPTER TWO RELOAD');
    const restoredProgress = page.getByRole('progressbar', { name: 'Reading progress' });
    await expect(restoredProgress).toBeVisible();
    const savedPercent = await restoredProgress.getAttribute('aria-valuenow');
    expect(savedPercent).not.toBeNull();

    await selectReaderPassage(page, 'CHAPTER TWO RELOAD CONTENT');
    await page
      .locator('button')
      .filter({ hasText: /^Comment$/ })
      .click();
    const modal = page.getByRole('dialog', { name: 'Comment' });
    await expect(modal).toBeVisible();
    await modal.getByRole('textbox').fill('Offline comment before reload');
    await modal.getByRole('button', { name: 'Comment' }).click();
    await expect(modal).not.toBeVisible();

    // Hard-reload offline: the chapter and progress indicator must restore
    // from actual reader-created offline state, and the EPUB must be served
    // from Workbox's cache populated by the online load above.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => getChapterText(page), { timeout: 30000 })
      .toContain('CHAPTER TWO RELOAD');
    await expect
      .poll(() =>
        page.getByRole('progressbar', { name: 'Reading progress' }).getAttribute('aria-valuenow'),
      )
      .toBe(savedPercent);

    const commentsButton = page.getByRole('button', { name: /^Comments/ });
    await commentsButton.focus();
    await page.keyboard.press('Enter');
    const commentsPanel = page.locator('aside');
    await expect(commentsPanel.getByText('Offline comment before reload')).toBeVisible();
    await expect(commentsPanel.getByRole('status')).toContainText('Pending sync');
  });
});
