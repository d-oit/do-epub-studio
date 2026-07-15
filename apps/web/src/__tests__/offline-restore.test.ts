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

  it('queues and retrieves reading-insight sync items (A5)', async () => {
    const { addToSyncQueue, getSyncQueue, removeSyncQueueItem } = await import('../lib/offline/db');

    await addToSyncQueue({
      id: 'sq-ri-1',
      type: 'reading-insight',
      payload: {
        bookId: 'b-insights',
        buckets: [{ date: '2026-07-07', activeMinutes: 15, activePages: 3 }],
        mutationId: 'm-ri-1',
      },
      mutationId: 'm-ri-1',
      createdAt: Date.now(),
      attempts: 0,
    });

    const queue = await getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('reading-insight');

    // Simulate successful sync: remove from queue
    await removeSyncQueueItem('sq-ri-1');
    const afterRemove = await getSyncQueue();
    expect(afterRemove).toHaveLength(0);
  });

  it('persists comment status mutations for offline resolve (Plan 998)', async () => {
    const { saveAnnotation, getAnnotations } = await import('../lib/offline/db');

    const bookId = 'plan998-book';

    // Step 1: Create comment while offline (status: open)
    await saveAnnotation({
      id: 'c-998-1',
      bookId,
      type: 'comment',
      cfi: 'epubcfi(/6/14!/4/2/3:0)',
      comment: 'This will be resolved offline',
      createdAt: Date.now(),
      synced: false,
      mutationId: 'm-998-1',
      status: 'open',
      visibility: 'shared',
    });

    // Step 2: Resolve comment while offline (update status in IndexedDB)
    await saveAnnotation({
      id: 'c-998-1',
      bookId,
      type: 'comment',
      cfi: 'epubcfi(/6/14!/4/2/3:0)',
      comment: 'This will be resolved offline',
      createdAt: Date.now(),
      synced: false,
      mutationId: 'm-998-2',
      status: 'resolved',
      visibility: 'shared',
    });

    // Step 3: Simulate page refresh — read from IndexedDB
    const retrieved = await getAnnotations(bookId);
    const resolvedComment = retrieved.find((a) => a.id === 'c-998-1');

    expect(resolvedComment).toBeDefined();
    expect(resolvedComment?.status).toBe('resolved');
    expect(resolvedComment?.visibility).toBe('shared');
  });

  it('full round-trip: all annotation types + progress + insights survive offline', async () => {
    const {
      saveAnnotation,
      getAnnotations,
      saveProgress,
      getProgress,
      saveReadingInsight,
      getReadingInsightsForBook,
      addToSyncQueue,
      getSyncQueue,
    } = await import('../lib/offline/db');

    const bookId = 'full-roundtrip-book';

    // Seed all annotation types
    await saveAnnotation({
      id: 'fr-h', bookId, type: 'highlight', cfi: 'epubcfi(/1)',
      text: 'Key insight', color: 'yellow', chapter: 'Ch 1',
      createdAt: Date.now(), synced: false, mutationId: 'fr-mh',
    });
    await saveAnnotation({
      id: 'fr-c', bookId, type: 'comment', cfi: 'epubcfi(/2)',
      comment: 'Great passage',
      createdAt: Date.now() - 500, synced: false, mutationId: 'fr-mc',
    });
    await saveAnnotation({
      id: 'fr-b', bookId, type: 'bookmark', cfi: 'epubcfi(/3)',
      chapter: 'Ch 2',
      createdAt: Date.now() - 1000, synced: false, mutationId: 'fr-mb',
    });

    // Seed progress
    await saveProgress({
      id: `fr-prog-${bookId}`, bookId, cfi: 'epubcfi(/3)',
      percentage: 65, lastRead: Date.now(), synced: false, mutationId: 'fr-mp',
    });

    // Seed reading insights
    await saveReadingInsight({
      bookId, date: '2026-07-07', activeMinutes: 20, activePages: 5, lastUpdated: Date.now(),
    });

    // Seed sync queue with all types
    await addToSyncQueue({
      id: 'fr-sq-1', type: 'progress', payload: { bookId, cfi: 'epubcfi(/3)', percentage: 65 },
      mutationId: 'fr-mp', createdAt: Date.now(), attempts: 0,
    });
    await addToSyncQueue({
      id: 'fr-sq-2', type: 'annotation', payload: { bookId, annotation: { type: 'highlight' } },
      mutationId: 'fr-mh', createdAt: Date.now() - 100, attempts: 0,
    });
    await addToSyncQueue({
      id: 'fr-sq-3', type: 'bookmark', payload: { bookId, cfi: 'epubcfi(/3)' },
      mutationId: 'fr-mb', createdAt: Date.now() - 200, attempts: 0,
    });
    await addToSyncQueue({
      id: 'fr-sq-4', type: 'reading-insight',
      payload: { bookId, buckets: [{ date: '2026-07-07', activeMinutes: 20, activePages: 5 }] },
      mutationId: 'fr-mri', createdAt: Date.now() - 300, attempts: 0,
    });

    // Verify all annotations restored
    const annotations = await getAnnotations(bookId);
    expect(annotations).toHaveLength(3);
    const annTypes = annotations.map((a) => a.type).sort();
    expect(annTypes).toEqual(['bookmark', 'comment', 'highlight']);

    // Verify progress restored
    const progress = await getProgress(bookId);
    expect(progress).toBeDefined();
    expect(progress?.percentage).toBe(65);

    // Verify reading insights restored
    const insights = await getReadingInsightsForBook(bookId);
    expect(insights).toHaveLength(1);
    expect(insights[0].activeMinutes).toBe(20);
    expect(insights[0].activePages).toBe(5);

    // Verify sync queue has all 4 types
    const queue = await getSyncQueue();
    expect(queue).toHaveLength(4);
    const queueTypes = queue.map((q) => q.type).sort();
    expect(queueTypes).toEqual(['annotation', 'bookmark', 'progress', 'reading-insight']);
  });
});
