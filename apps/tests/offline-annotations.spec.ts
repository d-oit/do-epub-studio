import { test, expect } from '@playwright/test';
import type { Page, Route, Request } from '@playwright/test';
import { decryptJSON } from '../web/src/lib/offline/crypto';
import {
  createMinimalEpub,
  loginAsReader,
  mockReaderApi,
  selectReaderPassage,
  suppressWorkboxErrors,
  TEST_USER,
} from './fixtures';

const EPUB_BUFFER = createMinimalEpub(
  [
    {
      id: 'c1',
      href: 'chapter1.xhtml',
      title: 'Chapter 1',
      body: '<p>OFFLINE ANNOTATION PASSAGE</p>',
    },
    {
      id: 'c2',
      href: 'chapter2.xhtml',
      title: 'Chapter 2',
      body: '<p>SECOND OFFLINE CHAPTER</p>',
    },
  ],
  { title: 'A1 Offline Book', identifier: 'urn:uuid:offline-annotations-book' },
);

const EPUB_URL = 'http://127.0.0.1:0/test/offline-annotations.epub';
const FULL_CAPABILITIES_LOGIN = {
  ok: true,
  data: {
    sessionToken: 'test-offline-session-token',
    book: {
      id: 'book-offline-a1',
      slug: TEST_USER.bookSlug,
      title: 'A1 Offline Book',
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
type StoredOfflineDatabase = {
  annotations: Record<string, unknown>[];
  queue: Record<string, unknown>[];
};

async function readOfflineDatabase(page: Page): Promise<StoredOfflineDatabase> {
  return page.evaluate(async () => {
    const request = indexedDB.open('do-epub-studio', 5);
    return new Promise<StoredOfflineDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['annotations', 'syncQueue'], 'readonly');
        const annotations = tx.objectStore('annotations').getAll();
        const queue = tx.objectStore('syncQueue').getAll();
        tx.oncomplete = () => {
          db.close();
          resolve({
            annotations: annotations.result as Record<string, unknown>[],
            queue: queue.result as Record<string, unknown>[],
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
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    queue.map((item) => {
      if (typeof item.encryptedPayload !== 'string') {
        throw new Error('Sync queue record must store its payload encrypted');
      }
      return decryptJSON<Record<string, unknown>>(
        item.encryptedPayload,
        FULL_CAPABILITIES_LOGIN.data.sessionToken,
      );
    }),
  );
}

interface ServerHighlightDTO {
  id: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

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
}
interface HighlightCreateRequest {
  mutationId?: string;
  locator: { chapterRef: string; cfi: string; selectedText: string };
  note?: string;
  color?: string;
}

interface CommentCreateRequest {
  mutationId?: string;
  locator?: { chapterRef: string; cfi: string; selectedText: string };
  body: string;
  visibility?: string;
}

interface CapturedCreateRequest<T> {
  authorization: string | undefined;
  body: T;
}

test.describe('Offline Annotations A1 (@pwa)', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => {
      console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    suppressWorkboxErrors(page);
  });

  test('@pwa creates ordinary highlight and shared comment offline, reloads, navigates, and settles on reconnect', async ({
    page,
    context,
  }) => {
    let isOfflineNetwork = false;
    let rejectHighlightWrites = false;
    let rejectCommentWrites = false;
    const acceptedHighlights: ServerHighlightDTO[] = [];
    const acceptedComments: ServerCommentDTO[] = [];
    const acceptedHighlightRequests: CapturedCreateRequest<HighlightCreateRequest>[] = [];
    const acceptedCommentRequests: CapturedCreateRequest<CommentCreateRequest>[] = [];
    const seenHighlightMutations = new Set<string>();
    const seenCommentMutations = new Set<string>();
    await mockReaderApi(context, {
      bookSlug: TEST_USER.bookSlug,
      epubUrl: EPUB_URL,
      epubBuffer: EPUB_BUFFER,
      loginResponse: FULL_CAPABILITIES_LOGIN,
      includeFeedback: true,
    });
    // Stateful endpoint overrides
    await context.route('**/api/books/*/highlights', async (route: Route, request: Request) => {
      if (isOfflineNetwork) {
        await route.abort('internetdisconnected');
        return;
      }

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: acceptedHighlights }),
        });
        return;
      }

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as HighlightCreateRequest;
        if (rejectHighlightWrites) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: { code: 'ACCESS_DENIED', message: 'Access denied' },
            }),
          });
          return;
        }

        const mutationId = body.mutationId ?? 'anon-hl';
        let match = acceptedHighlights.find(
          (h) => (h as unknown as { mutationId?: string }).mutationId === mutationId,
        );
        if (!match && !seenHighlightMutations.has(mutationId)) {
          seenHighlightMutations.add(mutationId);
          const now = new Date().toISOString();
          match = {
            id: `server-hl-${acceptedHighlights.length + 1}`,
            chapterRef: body.locator.chapterRef,
            cfiRange: body.locator.cfi,
            selectedText: body.locator.selectedText,
            note: body.note ?? null,
            color: body.color ?? '#ffff00',
            createdAt: now,
            updatedAt: now,
          };
          Object.assign(match, { mutationId });
          acceptedHighlights.push(match);
          acceptedHighlightRequests.push({ authorization: request.headers().authorization, body });
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

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as CommentCreateRequest;
        if (rejectCommentWrites) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: { code: 'ACCESS_DENIED', message: 'Access denied' },
            }),
          });
          return;
        }

        const mutationId = body.mutationId ?? 'anon-cm';
        let match = acceptedComments.find(
          (c) => (c as unknown as { mutationId?: string }).mutationId === mutationId,
        );
        if (!match && !seenCommentMutations.has(mutationId)) {
          seenCommentMutations.add(mutationId);
          const now = new Date().toISOString();
          match = {
            id: `server-cm-${acceptedComments.length + 1}`,
            displayName: 're***',
            isOwn: true,
            chapterRef: body.locator?.chapterRef ?? null,
            cfiRange: body.locator?.cfi ?? null,
            selectedText: body.locator?.selectedText ?? null,
            body: body.body,
            status: 'open',
            visibility: body.visibility ?? 'shared',
            parentCommentId: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
          };
          Object.assign(match, { mutationId });
          acceptedComments.push(match);
          acceptedCommentRequests.push({ authorization: request.headers().authorization, body });
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

    // Route guard on context level registered last (evaluated first in Playwright)
    await context.route('**/api/**', async (route: Route) => {
      if (isOfflineNetwork) {
        await route.abort('internetdisconnected');
        return;
      }
      await route.fallback();
    });

    // Login and acquire service worker
    await loginAsReader(page, TEST_USER.bookSlug);

    const getChapterText = async () =>
      page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const texts = iframes.map(
          (f) =>
            f.contentDocument?.body?.textContent ??
            f.contentWindow?.document?.body?.textContent ??
            '',
        );
        return (
          texts.join(' ') ||
          (document.querySelector('div[data-reader-viewer="true"]')?.textContent ?? '')
        );
      });

    await expect.poll(getChapterText, { timeout: 30000 }).toContain('OFFLINE ANNOTATION PASSAGE');

    // Reload to ensure SW controls the client
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
    await expect
      .poll(() => getChapterText(), {
        timeout: 30000,
        message: 'The reader must render the cached chapter after service-worker control',
      })
      .toContain('OFFLINE ANNOTATION PASSAGE');

    // Seed fixture EPUB bytes into SW cache
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

    // Go offline
    isOfflineNetwork = true;
    await context.setOffline(true);
    // Create yellow highlight
    await selectReaderPassage(page, 'OFFLINE ANNOTATION PASSAGE');
    await page.getByRole('button', { name: 'Highlight' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Yellow' })).toBeVisible();
    await page.getByRole('button', { name: 'Yellow' }).click();

    // Select passage again and create ordinary comment
    await selectReaderPassage(page, 'OFFLINE ANNOTATION PASSAGE');
    await page
      .locator('button')
      .filter({ hasText: /^Comment$/ })
      .click();
    const commentModal = page.getByRole('dialog', { name: 'Comment' });
    await expect(commentModal).toBeVisible();
    await commentModal.getByRole('textbox').fill('My shared offline note');
    await commentModal.getByRole('button', { name: 'Comment' }).click();
    await expect(commentModal).not.toBeVisible();

    // Open comments panel and verify pending state
    const commentsButton = page.getByRole('button', { name: /^Comments/ });
    await commentsButton.focus();
    await page.keyboard.press('Enter');
    const commentsPanel = page.locator('aside');
    await expect(commentsPanel.getByText('My shared offline note')).toBeVisible();
    await expect(commentsPanel.getByRole('status')).toContainText('Pending sync');
    const highlightsTab = page.getByRole('tab', { name: /Highlight/ });
    await highlightsTab.click();
    const highlightQuote = page
      .getByRole('tabpanel')
      .getByRole('button')
      .filter({ hasText: 'OFFLINE ANNOTATION PASSAGE' })
      .first();
    await expect(highlightQuote).toBeVisible();
    await expect(page.getByRole('tabpanel').getByRole('status')).toContainText('Pending sync');

    // Verify IDB has encrypted records and no plaintext
    const idbDump = await readOfflineDatabase(page);

    expect(idbDump.annotations.length).toBe(2);
    const decryptedQueue = await decryptQueueItems(idbDump.queue);
    const annotationQueue = decryptedQueue.filter((item) => item.type === 'annotation');
    expect(annotationQueue).toHaveLength(2);
    const queuedAnnotationIds = annotationQueue
      .map((item) => {
        const payload = item.payload as {
          action?: unknown;
          annotation?: { id?: unknown; mutationId?: unknown };
        };
        expect(payload.action).toBe('create');
        expect(item.mutationId).toBe(payload.annotation?.mutationId);
        return String(payload.annotation?.id);
      })
      .sort();
    expect(queuedAnnotationIds).toEqual(
      idbDump.annotations.map((annotation) => String(annotation.id)).sort(),
    );

    for (const queuedItem of idbDump.queue) {
      expect(queuedItem.encryptedPayload).toBeDefined();
      expect(queuedItem.payload).toBeUndefined();
    }
    for (const ann of idbDump.annotations) {
      expect(ann.encryptedPayload).toBeDefined();
      expect(ann.text).toBeUndefined();
      expect(ann.comment).toBeUndefined();
    }

    // Offline reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(getChapterText, { timeout: 30000 }).toContain('OFFLINE ANNOTATION PASSAGE');

    // Navigate to chapter 2
    const nextBtn = page.getByRole('button', { name: 'Next page' });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
    }
    // Verify chapter 2 is rendered or navigate via TOC
    const contentsBtn = page.getByRole('button', { name: 'Contents' });
    await contentsBtn.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Chapter 2' }).click();
    await expect.poll(getChapterText, { timeout: 15000 }).toContain('SECOND OFFLINE CHAPTER');

    // Navigate back to each retained anchor from the corresponding annotation tab.
    await commentsButton.focus();
    await page.keyboard.press('Enter');
    await highlightsTab.click();
    await expect(highlightQuote).toBeVisible();
    await expect(page.getByRole('tabpanel').getByRole('status')).toContainText('Pending sync');
    await highlightQuote.click();
    await expect.poll(getChapterText, { timeout: 15000 }).toContain('OFFLINE ANNOTATION PASSAGE');

    const commentsTab = page.getByRole('tab', { name: /Comment/ });
    await commentsTab.click();
    const commentQuote = page.locator('aside [role="tabpanel"] [role="button"]').first();
    await expect(commentQuote).toContainText('OFFLINE ANNOTATION PASSAGE');
    await expect(page.locator('aside').getByText('My shared offline note')).toBeVisible();
    await expect(page.locator('aside [role="tabpanel"] [role="status"]')).toContainText(
      'Pending sync',
    );
    await commentQuote.click();
    await expect.poll(getChapterText, { timeout: 15000 }).toContain('OFFLINE ANNOTATION PASSAGE');

    // Reconnect
    isOfflineNetwork = false;
    await context.setOffline(false);

    // Wait for server to receive records and sync to complete
    await expect.poll(() => acceptedHighlights.length, { timeout: 20000 }).toBe(1);
    await expect.poll(() => acceptedComments.length, { timeout: 20000 }).toBe(1);
    await expect(page.locator('aside [role="status"]')).toHaveCount(0, { timeout: 20000 });
    await expect
      .poll(async () => (await readOfflineDatabase(page)).queue.length, { timeout: 20000 })
      .toBe(0);
    expect(acceptedHighlightRequests).toHaveLength(1);
    expect(acceptedCommentRequests).toHaveLength(1);
    const highlightRequest = acceptedHighlightRequests[0];
    const commentRequest = acceptedCommentRequests[0];
    if (!highlightRequest || !commentRequest)
      throw new Error('Expected one accepted request per annotation');
    expect(highlightRequest.authorization).toBe('Bearer test-offline-session-token');
    expect(highlightRequest.body.mutationId ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(highlightRequest.body.locator).toMatchObject({
      chapterRef: 'chapter1.xhtml',
      selectedText: 'OFFLINE ANNOTATION PASSAGE',
    });
    expect(highlightRequest.body.locator.cfi).toBeTruthy();
    expect(highlightRequest.body.color).toBe('#ffff00');
    expect(commentRequest.authorization).toBe('Bearer test-offline-session-token');
    expect(commentRequest.body.mutationId ?? '').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(commentRequest.body.locator).toMatchObject({
      chapterRef: 'chapter1.xhtml',
      selectedText: 'OFFLINE ANNOTATION PASSAGE',
    });
    expect(commentRequest.body.locator?.cfi).toBeTruthy();
    expect(commentRequest.body.body).toBe('My shared offline note');
    expect(commentRequest.body.visibility).toBe('shared');

    // Reload online to verify persisted annotations and stable reader initialization.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(getChapterText, { timeout: 30000 }).toContain('OFFLINE ANNOTATION PASSAGE');
    await commentsButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('aside').getByText('My shared offline note')).toHaveCount(1);

    // Online 403s must not create pending records or dismiss rejected comment text.
    rejectHighlightWrites = true;
    await selectReaderPassage(page, 'OFFLINE ANNOTATION PASSAGE');
    await page.getByRole('button', { name: 'Highlight' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Yellow' })).toBeVisible();
    await page.getByRole('button', { name: 'Yellow' }).click();
    await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
    expect(acceptedHighlightRequests).toHaveLength(1);
    let rejectionState = await readOfflineDatabase(page);
    expect(rejectionState.annotations).toHaveLength(2);
    expect(
      (await decryptQueueItems(rejectionState.queue)).filter((item) => item.type === 'annotation'),
    ).toHaveLength(0);

    rejectCommentWrites = true;
    await selectReaderPassage(page, 'OFFLINE ANNOTATION PASSAGE');
    const selectionCommentButton = page.locator('button').filter({ hasText: /^Comment$/ });
    await selectionCommentButton.focus();
    await page.keyboard.press('Enter');
    const rejectedCommentModal = page.getByRole('dialog', { name: 'Comment' });
    const rejectedCommentInput = rejectedCommentModal.getByRole('textbox');
    await rejectedCommentInput.fill('Rejected shared comment');
    await rejectedCommentModal.getByRole('button', { name: 'Comment' }).click();
    await expect(rejectedCommentModal.getByRole('alert')).toHaveText('Access denied');
    await expect(rejectedCommentInput).toHaveValue('Rejected shared comment');
    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    expect(acceptedCommentRequests).toHaveLength(1);
    rejectionState = await readOfflineDatabase(page);
    expect(rejectionState.annotations).toHaveLength(2);
    expect(
      (await decryptQueueItems(rejectionState.queue)).filter((item) => item.type === 'annotation'),
    ).toHaveLength(0);
    await rejectedCommentModal.getByRole('button', { name: 'Cancel' }).click();

    // A queued create rejected on reconnect stays locally failed and no longer retries.
    isOfflineNetwork = true;
    await context.setOffline(true);
    await selectReaderPassage(page, 'OFFLINE ANNOTATION PASSAGE');
    await page.getByRole('button', { name: 'Highlight' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Yellow' })).toBeVisible();
    await page.getByRole('button', { name: 'Yellow' }).click();
    await highlightsTab.click();
    await expect(page.getByRole('tabpanel').getByRole('status')).toContainText('Pending sync');
    const queuedFailureState = await readOfflineDatabase(page);
    expect(
      (await decryptQueueItems(queuedFailureState.queue)).filter(
        (item) => item.type === 'annotation',
      ),
    ).toHaveLength(1);

    isOfflineNetwork = false;
    await context.setOffline(false);
    const failedAlert = page
      .getByRole('tabpanel')
      .getByRole('alert')
      .filter({ hasText: 'Access denied' });
    await expect(failedAlert).toBeVisible({ timeout: 20000 });
    await expect(failedAlert.locator('xpath=../..')).toContainText('OFFLINE ANNOTATION PASSAGE');
    const failedState = await readOfflineDatabase(page);
    expect(
      (await decryptQueueItems(failedState.queue)).filter((item) => item.type === 'annotation'),
    ).toHaveLength(0);
    const failedAnnotations: Array<Record<string, unknown>> = await Promise.all(
      failedState.annotations.map(async (annotation) => {
        if (typeof annotation.encryptedPayload !== 'string') {
          throw new Error('Offline annotation record must store its payload encrypted');
        }
        return {
          ...(await decryptJSON<Record<string, unknown>>(
            annotation.encryptedPayload,
            FULL_CAPABILITIES_LOGIN.data.sessionToken,
          )),
          id: annotation.id,
          bookId: annotation.bookId,
          synced: annotation.synced,
        };
      }),
    );
    expect(
      failedAnnotations.filter((annotation) => annotation.syncError === 'Access denied'),
    ).toHaveLength(1);
    expect(
      failedAnnotations.find((annotation) => annotation.syncError === 'Access denied'),
    ).toMatchObject({
      text: 'OFFLINE ANNOTATION PASSAGE',
      synced: false,
      syncError: 'Access denied',
    });
  });
});
