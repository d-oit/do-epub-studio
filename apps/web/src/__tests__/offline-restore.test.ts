import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../lib/offline/crypto', () => ({
  encryptJSON: vi.fn().mockImplementation((_data: unknown, _token: string) =>
    Promise.resolve(JSON.stringify(_data)),
  ),
  decryptJSON: vi.fn().mockImplementation((payload: string) =>
    Promise.resolve(JSON.parse(payload)),
  ),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({
      sessionToken: 'test-token-for-offline-restore',
    }),
  },
}));

describe('Offline restore — annotations (M4 from Plan 118)', () => {
  beforeEach(async () => {
    const { closeDb } = await import('../lib/offline/db');
    closeDb();
  });

  afterEach(async () => {
    const { closeDb, clearAllEncryptedData } = await import('../lib/offline/db');
    try {
      await clearAllEncryptedData();
    } catch {
      // ignore cleanup errors
    }
    closeDb();
  });

  it('saves and retrieves highlights, comments, and bookmarks for a book', async () => {
    const { saveAnnotation, getAnnotations } = await import('../lib/offline/db');

    const bookId = 'test-book-restore';

    const highlight = {
      id: 'h-1',
      bookId,
      type: 'highlight' as const,
      cfi: 'epubcfi(/6/14!/4/2/1:0)',
      text: 'Important passage',
      color: '#ffeb3b',
      chapter: 'Chapter 1',
      createdAt: Date.now(),
      synced: false,
      mutationId: 'm-1',
    };

    const comment = {
      id: 'c-1',
      bookId,
      type: 'comment' as const,
      cfi: 'epubcfi(/6/14!/4/2/3:0)',
      comment: 'My thoughts on this section',
      createdAt: Date.now() - 1000,
      synced: false,
      mutationId: 'm-2',
    };

    const bookmark = {
      id: 'b-1',
      bookId,
      type: 'bookmark' as const,
      cfi: 'epubcfi(/6/14!/4/3/1:0)',
      chapter: 'Chapter 2',
      createdAt: Date.now() - 2000,
      synced: false,
      mutationId: 'm-3',
    };

    await saveAnnotation(highlight);
    await saveAnnotation(comment);
    await saveAnnotation(bookmark);

    const retrieved = await getAnnotations(bookId);

    expect(retrieved).toHaveLength(3);

    const types = retrieved.map((a) => a.type).sort();
    expect(types).toEqual(['bookmark', 'comment', 'highlight']);

    const retrievedHighlight = retrieved.find((a) => a.type === 'highlight');
    expect(retrievedHighlight?.text).toBe('Important passage');
    expect(retrievedHighlight?.cfi).toBe('epubcfi(/6/14!/4/2/1:0)');

    const retrievedComment = retrieved.find((a) => a.type === 'comment');
    expect(retrievedComment?.comment).toBe('My thoughts on this section');

    const retrievedBookmark = retrieved.find((a) => a.type === 'bookmark');
    expect(retrievedBookmark?.chapter).toBe('Chapter 2');
  });

  it('saves and retrieves progress for offline fallback', async () => {
    const { saveProgress, getProgress } = await import('../lib/offline/db');

    const bookId = 'test-book-progress';

    await saveProgress({
      id: `progress-${bookId}`,
      bookId,
      cfi: 'epubcfi(/6/14!/4/5/1:0)',
      percentage: 42.5,
      lastRead: Date.now(),
      synced: false,
      mutationId: 'm-prog-1',
    });

    const retrieved = await getProgress(bookId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.cfi).toBe('epubcfi(/6/14!/4/5/1:0)');
    expect(retrieved?.percentage).toBe(42.5);
  });

  it('queues sync items for offline annotations', async () => {
    const { addToSyncQueue, getSyncQueue } = await import('../lib/offline/db');

    await addToSyncQueue({
      id: 'sq-1',
      type: 'annotation',
      payload: { bookId: 'b', annotation: { id: 'h-2' } },
      mutationId: 'm-sq-1',
      createdAt: Date.now(),
      attempts: 0,
    });

    await addToSyncQueue({
      id: 'sq-2',
      type: 'bookmark',
      payload: { bookId: 'b', bookmark: { id: 'bm-1' } },
      mutationId: 'm-sq-2',
      createdAt: Date.now() - 100,
      attempts: 0,
    });

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(2);

    const types = queue.map((q) => q.type).sort();
    expect(types).toEqual(['annotation', 'bookmark']);
  });
});
