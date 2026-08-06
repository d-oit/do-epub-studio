import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetDrainPromise } from '../lib/offline/sync';

// Mock the db module
vi.mock('../lib/offline/db', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn().mockResolvedValue([]),
  removeSyncQueueItem: vi.fn(),
  updateSyncQueueItem: vi.fn(),
  getUnsyncedProgress: vi.fn().mockResolvedValue([]),
  getUnsyncedAnnotations: vi.fn().mockResolvedValue([]),
  saveProgress: vi.fn(),
  saveAnnotation: vi.fn(),
}));

// Mock the api module
const mockPut = vi.fn();
const mockPost = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  apiRequest: vi.fn(),
}));

// Mock the permissions module
vi.mock('../lib/offline/permissions', () => ({
  clearAllPermissions: vi.fn(),
}));

// Mock the client-logger module
vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

// Mock the shared module
vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: vi.fn(() => 'test-trace-id'),
  createSpanId: vi.fn(() => 'test-span-id'),
}));

// Mock conflict-resolution module
vi.mock('../lib/offline/conflict-resolution', () => ({
  resolveConflict: vi.fn(),
  ConflictType: {
    ProgressUpdate: 'progress_update',
    AnnotationEdit: 'annotation_edit',
    BookmarkChange: 'bookmark_change',
    CommentUpdate: 'comment_update',
  },
  getPendingConflicts: vi.fn().mockReturnValue([]),
  clearResolvedConflicts: vi.fn(),
  detectConflict: vi.fn(),
  resolveWithLWW: vi.fn(),
  resolveManualConflict: vi.fn(),
  clearAllConflicts: vi.fn(),
  hasPendingConflicts: vi.fn(),
}));

describe('Sync Conflict Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDrainPromise();
  });

  describe('syncItem with 409 conflict for progress', () => {
    it('should call resolveConflict when progress PUT returns 409', async () => {
      const { getSyncQueue } = await import('../lib/offline/db');
      const { resolveConflict } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-1',
        type: 'progress' as const,
        payload: {
          bookId: 'book-1',
          cfi: 'epubcfi(/6/14!/4/2/1:0)',
          percentage: 50,
          mutationId: 'mutation-1',
        },
        mutationId: 'mutation-1',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock resolveConflict to return local wins
      (resolveConflict as ReturnType<typeof vi.fn>).mockReturnValue({
        resolved: true,
        strategy: 'last_write_wins',
        winner: 'local',
        merged: syncQueueItem.payload,
      });

      // Mock api.put to throw 409
      mockPut.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));

      // Import and call syncAll to trigger the sync
      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Verify resolveConflict was called
      expect(resolveConflict).toHaveBeenCalled();
      expect(resolveConflict).toHaveBeenCalledWith(
        'progress_update',
        syncQueueItem.payload,
        null,
        syncQueueItem.createdAt,
        expect.any(Number),
        'book-1',
        'book-1',
      );
    });

    it('should return success when LWW resolves with local winner', async () => {
      const { getSyncQueue, removeSyncQueueItem } = await import('../lib/offline/db');
      const { resolveConflict } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-2',
        type: 'progress' as const,
        payload: {
          bookId: 'book-2',
          cfi: 'epubcfi(/6/14!/4/2/1:0)',
          percentage: 75,
          mutationId: 'mutation-2',
        },
        mutationId: 'mutation-2',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock resolveConflict to return local wins
      (resolveConflict as ReturnType<typeof vi.fn>).mockReturnValue({
        resolved: true,
        strategy: 'last_write_wins',
        winner: 'local',
        merged: syncQueueItem.payload,
      });

      // Mock api.put to throw 409
      mockPut.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));

      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Should remove item from queue (success)
      expect(removeSyncQueueItem).toHaveBeenCalledWith('item-2');
    });

    it('should remove item from queue when manual resolution is required', async () => {
      const { getSyncQueue, removeSyncQueueItem } = await import('../lib/offline/db');
      const { resolveConflict } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-3',
        type: 'progress' as const,
        payload: {
          bookId: 'book-3',
          cfi: 'epubcfi(/6/14!/4/2/1:0)',
          percentage: 25,
          mutationId: 'mutation-3',
        },
        mutationId: 'mutation-3',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock resolveConflict to return manual resolution needed
      (resolveConflict as ReturnType<typeof vi.fn>).mockReturnValue({
        resolved: false,
        strategy: 'manual',
        winner: 'local',
      });

      // Mock api.put to throw 409
      mockPut.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }));

      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Should remove item from queue (prevents infinite retries)
      expect(removeSyncQueueItem).toHaveBeenCalledWith('item-3');
    });

    it('should not call resolveConflict for non-409 errors', async () => {
      const { getSyncQueue, updateSyncQueueItem } = await import('../lib/offline/db');
      const { resolveConflict } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-4',
        type: 'progress' as const,
        payload: {
          bookId: 'book-4',
          cfi: 'epubcfi(/6/14!/4/2/1:0)',
          percentage: 10,
          mutationId: 'mutation-4',
        },
        mutationId: 'mutation-4',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock api.put to throw 500
      mockPut.mockRejectedValue(Object.assign(new Error('Server Error'), { status: 500 }));

      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Should not call resolveConflict for non-409 errors
      expect(resolveConflict).not.toHaveBeenCalled();

      // Should update item with error (retry logic)
      expect(updateSyncQueueItem).toHaveBeenCalled();
    });

    it('should clear pending conflicts after successful progress sync', async () => {
      const { getSyncQueue, removeSyncQueueItem } = await import('../lib/offline/db');
      const { getPendingConflicts, clearResolvedConflicts } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-5',
        type: 'progress' as const,
        payload: {
          bookId: 'book-5',
          cfi: 'epubcfi(/6/14!/4/2/1:0)',
          percentage: 60,
          mutationId: 'mutation-5',
        },
        mutationId: 'mutation-5',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock successful API call
      mockPut.mockResolvedValue({ ok: true });

      // Mock getPendingConflicts to return some conflicts
      (getPendingConflicts as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: 'conflict-1', bookId: 'book-5' },
        { id: 'conflict-2', bookId: 'book-5' },
      ]);

      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Should clear resolved conflicts after successful sync
      expect(clearResolvedConflicts).toHaveBeenCalled();

      // Should remove item from queue
      expect(removeSyncQueueItem).toHaveBeenCalledWith('item-5');
    });

    it('should not clear conflicts for non-progress sync types', async () => {
      const { getSyncQueue, removeSyncQueueItem } = await import('../lib/offline/db');
      const { clearResolvedConflicts } = await import('../lib/offline/conflict-resolution');

      const syncQueueItem = {
        id: 'item-6',
        type: 'annotation' as const,
        payload: {
          bookId: 'book-6',
          annotation: {
            id: 'ann-1',
            type: 'highlight',
            cfi: 'epubcfi(/6/14!/4/2/1:0)',
            text: 'test',
            color: '#ffff00',
          },
        },
        mutationId: 'mutation-6',
        createdAt: Date.now() - 1000,
        attempts: 0,
      };

      (getSyncQueue as ReturnType<typeof vi.fn>).mockResolvedValue([syncQueueItem]);

      // Mock successful API call
      mockPost.mockResolvedValue({ ok: true });

      const { syncAll } = await import('../lib/offline/sync');
      await syncAll();

      // Should not clear conflicts for annotation sync
      expect(clearResolvedConflicts).not.toHaveBeenCalled();

      // Should remove item from queue
      expect(removeSyncQueueItem).toHaveBeenCalledWith('item-6');
    });
  });
});
