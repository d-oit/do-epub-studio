import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../stores/auth';
import { useReaderStore } from '../stores/reader';
import {
  useHighlightHandlers,
  useCommentHandlers,
} from '../features/reader/hooks/useAnnotationHandlers';
import { getDB, closeDb, clearAllEncryptedData, getSyncQueue } from '../lib/offline/db';
import { getAnnotations } from '../lib/offline/annotation-mutations';
import { syncAll, resetDrainPromise, cancelPendingRetry } from '../lib/offline/sync';

const TEST_TOKEN = 'test-token-offline-annotations';
const TEST_BOOK_ID = 'book-offline-test';

const FIXTURE_SELECTION = {
  chapterRef: 'chapter1.xhtml',
  cfiRange: 'epubcfi(/6/2!/4/2/1:0)',
  text: 'OFFLINE ANNOTATION PASSAGE',
  rect: new DOMRect(),
};

/** Minimal fetch-Response stand-in carrying the app's JSON envelope. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('Reader Annotations Offline (A1)', () => {
  let originalOnLine: boolean;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDrainPromise();
    cancelPendingRetry();
    await clearAllEncryptedData();
    closeDb();
    originalOnLine = navigator.onLine;
    originalFetch = globalThis.fetch;

    useAuthStore.setState({
      sessionToken: TEST_TOKEN,
      bookId: TEST_BOOK_ID,
      email: 'reader@example.com',
      sessionExpiresAt: Date.now() + 3600000,
      capabilities: {
        canRead: true,
        canHighlight: true,
        canComment: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: false,
      },
      isAuthenticated: true,
    });

    useReaderStore.setState({
      highlights: [],
      comments: [],
      currentChapter: 'chapter1.xhtml',
    });
  });

  afterEach(async () => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    globalThis.fetch = originalFetch;
    cancelPendingRetry();
    resetDrainPromise();
    await clearAllEncryptedData();
    closeDb();
  });

  it('offline creation: yellow highlight and shared comment persist encrypted with anchors intact', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result: hlHandlers } = renderHook(() => useHighlightHandlers());
    const { result: cmHandlers } = renderHook(() => useCommentHandlers());

    await act(async () => {
      await hlHandlers.current.handleCreateHighlight('#ffff00', FIXTURE_SELECTION);
      await cmHandlers.current.handleCreateComment('Shared offline note', FIXTURE_SELECTION);
    });

    const decrypted = await getAnnotations(TEST_BOOK_ID);
    expect(decrypted).toHaveLength(2);

    const hl = decrypted.find((a) => a.type === 'highlight');
    expect(hl).toBeDefined();
    expect(hl?.chapter).toBe('chapter1.xhtml');
    expect(hl?.cfi).toBe('epubcfi(/6/2!/4/2/1:0)');
    expect(hl?.text).toBe('OFFLINE ANNOTATION PASSAGE');
    expect(hl?.color).toBe('#ffff00');
    expect(hl?.synced).toBe(false);

    const cm = decrypted.find((a) => a.type === 'comment');
    expect(cm).toBeDefined();
    expect(cm?.chapter).toBe('chapter1.xhtml');
    expect(cm?.cfi).toBe('epubcfi(/6/2!/4/2/1:0)');
    expect(cm?.text).toBe('OFFLINE ANNOTATION PASSAGE');
    expect(cm?.comment).toBe('Shared offline note');
    expect(cm?.status).toBe('open');
    expect(cm?.visibility).toBe('shared');
    expect(cm?.synced).toBe(false);

    // Verify raw IDB records are encrypted
    const db = await getDB();
    const rawHighlights = (await db.getAll('annotations')) as Record<string, unknown>[];
    for (const raw of rawHighlights) {
      expect(raw.encryptedPayload).toBeDefined();
      expect(typeof raw.encryptedPayload).toBe('string');
      expect(raw.text).toBeUndefined();
      expect(raw.comment).toBeUndefined();
      expect(raw.cfi).toBeUndefined();
    }

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(2);

    // Reopen database and check logical records
    closeDb();
    const reloaded = await getAnnotations(TEST_BOOK_ID);
    expect(reloaded).toHaveLength(2);
    expect(reloaded.map((r) => r.mutationId)).toEqual(decrypted.map((d) => d.mutationId));
  });

  it('network TypeError while online: commits local pending mutation and sync item', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const { result: hlHandlers } = renderHook(() => useHighlightHandlers());
    await act(async () => {
      await hlHandlers.current.handleCreateHighlight('#ffff00', FIXTURE_SELECTION);
      await syncAll();
    });
    cancelPendingRetry();
    const storeHighlights = useReaderStore.getState().highlights;
    expect(storeHighlights).toHaveLength(1);
    expect(storeHighlights[0]?.syncState).toBe('pending');

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.type).toBe('annotation');
  });

  it('reconnect settlement: server IDs replace local IDs and clear pending state after syncAll', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result: hlHandlers } = renderHook(() => useHighlightHandlers());

    await act(async () => {
      await hlHandlers.current.handleCreateHighlight('#ffff00', FIXTURE_SELECTION);
    });

    const pendingLocalId = useReaderStore.getState().highlights[0]?.id;
    expect(pendingLocalId).toMatch(/^local-annotation-/);

    // Reconnect
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const serverHighlightDTO = {
      id: 'server-hl-uuid-1',
      chapterRef: 'chapter1.xhtml',
      cfiRange: 'epubcfi(/6/2!/4/2/1:0)',
      selectedText: 'OFFLINE ANNOTATION PASSAGE',
      note: null,
      color: '#ffff00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        data: serverHighlightDTO,
      }),
    );

    await act(async () => {
      await syncAll();
    });

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(0);

    const storeHighlights = useReaderStore.getState().highlights;
    expect(storeHighlights).toHaveLength(1);
    expect(storeHighlights[0]?.id).toBe('server-hl-uuid-1');
    expect(storeHighlights[0]?.syncState).toBeUndefined();

    const canonical = await getAnnotations(TEST_BOOK_ID);
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.id).toBe('server-hl-uuid-1');
    expect(canonical[0]?.synced).toBe(true);
  });

  it('replay 403: produces a durable failed local item retaining text/anchor and removes queue item', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result: cmHandlers } = renderHook(() => useCommentHandlers());

    await act(async () => {
      await cmHandlers.current.handleCreateComment('Comment to be rejected', FIXTURE_SELECTION);
    });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        ok: false,
        error: { message: 'Access denied' },
      }),
    );

    await act(async () => {
      await syncAll();
    });

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(0);

    const storeComments = useReaderStore.getState().comments;
    expect(storeComments).toHaveLength(1);
    expect(storeComments[0]?.syncState).toBe('failed');
    expect(storeComments[0]?.syncError).toBe('Access denied');
    const canonical = await getAnnotations(TEST_BOOK_ID);
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.synced).toBe(false);
    expect(canonical[0]?.syncError).toBe('Access denied');
    expect(canonical[0]?.comment).toBe('Comment to be rejected');
  });
});
