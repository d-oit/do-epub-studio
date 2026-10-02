import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queueSync,
  syncAll,
  setupOnlineListener,
  cancelPendingRetry,
  setPermissionRevokedCallback,
  generateMutationId,
  resetDrainPromise,
  resendProgressFromConflict,
} from './sync';
import * as db from './db';
import type { SyncQueueItem } from './db';
import { api, apiRequest } from '../api';
import { clearAllPermissions } from './permissions';
import { ConflictType, type ConflictRecord } from './conflict-resolution';
import { useAuthStore } from '../../stores/auth';
import { createHighlight } from '../api/annotations';

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

vi.mock('./db', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn(),
  removeSyncQueueItem: vi.fn(),
  updateSyncQueueItem: vi.fn(),
  getUnsyncedProgress: vi.fn(),
  getUnsyncedAnnotations: vi.fn(),
  saveProgress: vi.fn(),
  saveAnnotation: vi.fn(),
  // conflict-resolution re-exports this const from ./db; the mock replaces
  // the whole module, so the values must be mirrored here for the resend tests.
  ConflictType: {
    ProgressUpdate: 'progress_update',
    AnnotationEdit: 'annotation_edit',
    BookmarkChange: 'bookmark_change',
    CommentUpdate: 'comment_update',
  },
}));

vi.mock('./annotation-mutations', () => ({
  saveAnnotation: vi.fn(),
  getAnnotations: vi.fn().mockResolvedValue([]),
  getUnsyncedAnnotations: vi.fn().mockResolvedValue([]),
  settleAnnotationCreation: vi.fn(),
  failAnnotationCreation: vi.fn(),
  subscribeAnnotationChanges: vi.fn(() => () => {}),
}));
vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiRequest: vi.fn(),
}));

vi.mock('../api/annotations', () => ({
  createHighlight: vi.fn(),
  createComment: vi.fn(),
}));

vi.mock('./permissions', () => ({
  clearAllPermissions: vi.fn(),
}));

vi.mock('../client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: () => 'trace-id',
  createSpanId: () => 'span-id',
}));

describe('sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    cancelPendingRetry();
    resetDrainPromise();
    setPermissionRevokedCallback(null as unknown as (bookId: string) => void);
  });

  afterEach(() => {
    cancelPendingRetry();
  });

  describe('generateMutationId', () => {
    it('generates a string id', () => {
      expect(typeof generateMutationId()).toBe('string');
    });
  });

  describe('queueSync', () => {
    it('adds item to sync queue', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm1' },
        'm1',
      );
      await vi.waitFor(() => {
        expect(db.addToSyncQueue).toHaveBeenCalled();
      });
    });
  });

  describe('attemptSync', () => {
    it('skips when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      await queueSync('progress', {}, 'm1');
      await new Promise((r) => setTimeout(r, 10));
      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });

    it('skips when queue is empty', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      await queueSync('progress', {}, 'm1');
      await new Promise((r) => setTimeout(r, 10));
      expect(api.post).not.toHaveBeenCalled();
    });

    it('does not replay one session’s queue snapshot after switching sessions', async () => {
      const originalAuth = useAuthStore.getState();
      let resolveSnapshot!: (queue: SyncQueueItem[]) => void;
      const snapshot = new Promise<SyncQueueItem[]>((resolve) => {
        resolveSnapshot = resolve;
      });
      const privateAnnotation: SyncQueueItem = {
        id: 'annotation-a',
        type: 'annotation',
        payload: {
          bookId: 'book-a',
          action: 'create',
          annotation: {
            id: 'local-annotation-a',
            bookId: 'book-a',
            type: 'highlight',
            cfi: 'epubcfi(/6/4!/4/2)',
            text: 'Private passage owned by session A',
            color: '#ffff00',
            createdAt: 1,
            synced: false,
            mutationId: 'mutation-a',
          },
        },
        mutationId: 'mutation-a',
        createdAt: 1,
        attempts: 0,
      };

      try {
        useAuthStore.setState({
          sessionToken: 'session-token-a',
          bookId: 'book-a',
          isAuthenticated: true,
        });
        vi.mocked(db.getSyncQueue).mockReturnValue(snapshot);
        const drain = syncAll();

        await vi.waitFor(() => {
          expect(db.getSyncQueue).toHaveBeenCalledTimes(1);
        });
        useAuthStore.setState({
          sessionToken: 'session-token-b',
          bookId: 'book-b',
        });
        resolveSnapshot([privateAnnotation]);
        await drain;

        expect(createHighlight).not.toHaveBeenCalled();
        expect(apiRequest).not.toHaveBeenCalled();
        expect(db.removeSyncQueueItem).not.toHaveBeenCalled();
      } finally {
        useAuthStore.setState(originalAuth);
      }
    });

    it('syncs progress item successfully via PUT', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-1',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi-1', percentage: 50, mutationId: 'm1' },
          mutationId: 'm1',
          createdAt: 100,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockResolvedValue({} as unknown as Response);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([
        {
          id: 'p1',
          bookId: 'b1',
          cfi: 'cfi-1',
          percentage: 50,
          lastRead: 100,
          synced: false,
          mutationId: 'm1',
        },
      ]);

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi-1', percentage: 50, mutationId: 'm1' },
        'm1',
      );
      await vi.waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/books/b1/progress', {
          locator: { cfi: 'cfi-1' },
          progressPercent: 50,
          mutationId: 'm1',
        });
      });
      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-1');
      });
    });

    it('retries on generic error', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-4',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm4' },
          mutationId: 'm4',
          createdAt: 400,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue(new Error('Network error'));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm4' },
        'm4',
      );
      await vi.waitFor(() => {
        expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
          expect.objectContaining({ attempts: 1, error: 'Network error' }),
        );
      });
    });

    it('handles permission revocation on 401', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-5',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm5' },
          mutationId: 'm5',
          createdAt: 500,
          attempts: 0,
        },
      ]);
      const err = Object.assign(new Error('Unauthorized'), { status: 401 });
      vi.mocked(api.put).mockRejectedValue(err);

      const mockCallback = vi.fn();
      setPermissionRevokedCallback(mockCallback);

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm5' },
        'm5',
      );
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
      expect(mockCallback).toHaveBeenCalledWith('b1');
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-5');
    });

    it('handles permission revocation on 403', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-6',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm6' },
          mutationId: 'm6',
          createdAt: 600,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm6' },
        'm6',
      );
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('does not treat a generic permission message as revocation', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-71',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm71' },
          mutationId: 'm71',
          createdAt: 7100,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue(new Error('permission denied'));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm71' },
        'm71',
      );
      await vi.waitFor(() => {
        expect(db.updateSyncQueueItem).toHaveBeenCalled();
      });
      expect(clearAllPermissions).not.toHaveBeenCalled();
    });

    it('treats revoked mention without status as revocation', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-72',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm72' },
          mutationId: 'm72',
          createdAt: 7200,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue(new Error('Access has been revoked or expired'));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm72' },
        'm72',
      );
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('handles revoked in error message', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-14',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm14' },
          mutationId: 'm14',
          createdAt: 1400,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue(new Error('Session revoked'));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm14' },
        'm14',
      );
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('removes item after max retries exceeded', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-8',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' },
          mutationId: 'm8',
          createdAt: 800,
          attempts: 5,
        },
      ]);

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' },
        'm8',
      );
      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-8');
      });
      expect(api.put).not.toHaveBeenCalled();
    });

    it('marks progress entry as synced', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-11',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm11' },
          mutationId: 'm11',
          createdAt: 1100,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockResolvedValue({} as unknown as Response);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([
        {
          id: 'p1',
          bookId: 'b1',
          cfi: 'cfi',
          percentage: 50,
          lastRead: 100,
          synced: false,
          mutationId: 'm11',
        },
      ]);

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm11' },
        'm11',
      );
      await vi.waitFor(() => {
        expect(db.saveProgress).toHaveBeenCalledWith(expect.objectContaining({ synced: true }));
      });
    });

    it('syncs comment resolve action via PATCH', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-16',
          type: 'annotation',
          payload: {
            bookId: 'b1',
            annotation: { id: 'comment-1', status: 'resolved' },
            action: 'resolve',
          },
          mutationId: 'm16',
          createdAt: 1600,
          attempts: 0,
        },
      ]);
      vi.mocked(apiRequest).mockResolvedValue({});

      await queueSync(
        'annotation',
        { bookId: 'b1', annotation: { id: 'comment-1', status: 'resolved' }, action: 'resolve' },
        'm16',
      );
      await vi.waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/api/comments/comment-1', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'resolved' }),
        });
      });
    });

    it('handles non-Error thrown values', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-15',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm15' },
          mutationId: 'm15',
          createdAt: 1500,
          attempts: 0,
        },
      ]);
      vi.mocked(api.put).mockRejectedValue('string error');

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm15' },
        'm15',
      );
      await vi.waitFor(() => {
        expect(db.updateSyncQueueItem).toHaveBeenCalled();
      });
    });
  });

  describe('resendProgressFromConflict', () => {
    function progressConflict(overrides?: Partial<ConflictRecord>): ConflictRecord {
      return {
        id: 'conflict-1',
        type: ConflictType.ProgressUpdate,
        localVersion: { bookId: 'b1', cfi: 'cfi-9', percentage: 42, mutationId: 'm9' },
        remoteVersion: { bookId: 'b1', cfi: 'remote-cfi', percentage: 90 },
        localTimestamp: 1000,
        remoteTimestamp: 1000,
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'b1',
        entityId: 'b1',
        createdAt: 900,
        ...overrides,
      };
    }

    it('re-queues the local progress version with its original mutationId', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      await resendProgressFromConflict(progressConflict());
      expect(db.addToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          mutationId: 'm9',
          payload: { bookId: 'b1', cfi: 'cfi-9', percentage: 42, mutationId: 'm9' },
        }),
      );
    });

    it('skips non-progress conflict types', async () => {
      await resendProgressFromConflict(progressConflict({ type: ConflictType.CommentUpdate }));
      expect(db.addToSyncQueue).not.toHaveBeenCalled();
    });

    it('skips a malformed local version without queueing', async () => {
      await resendProgressFromConflict(progressConflict({ localVersion: { bookId: 'b1' } }));
      expect(db.addToSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('syncAll', () => {
    it('skips when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      await syncAll();
      await new Promise((r) => setTimeout(r, 10));
      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('setupOnlineListener', () => {
    it('returns cleanup function', () => {
      const cleanup = setupOnlineListener();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('triggers sync on online event', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      const cleanup = setupOnlineListener();

      window.dispatchEvent(new Event('online'));
      await vi.waitFor(() => {
        expect(db.getSyncQueue).toHaveBeenCalled();
      });
      cleanup();
    });

    it('does not trigger sync on offline event', async () => {
      vi.mocked(db.getSyncQueue).mockReset();
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      const cleanup = setupOnlineListener();

      window.dispatchEvent(new Event('offline'));
      await new Promise((r) => setTimeout(r, 100));
      cleanup();
      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('single-flight drain', () => {
    it('only runs one drain for rapid concurrent queueSync calls', async () => {
      let resolveQueue!: (value: SyncQueueItem[]) => void;
      const queueDeferred = new Promise<SyncQueueItem[]>((resolve) => {
        resolveQueue = resolve;
      });

      vi.mocked(db.getSyncQueue).mockImplementation(() => queueDeferred);
      vi.mocked(api.put).mockResolvedValue({} as unknown as Response);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([]);

      // First queueSync starts the drain (getSyncQueue called once)
      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm1' },
        'm1',
      );

      // Rapid subsequent calls — ensureDrain returns existing promise, no new drain
      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 60, mutationId: 'm2' },
        'm2',
      );
      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 70, mutationId: 'm3' },
        'm3',
      );

      // All 3 items added to IndexedDB
      expect(db.addToSyncQueue).toHaveBeenCalledTimes(3);

      // Only 1 drain started — getSyncQueue called once (pending)
      expect(db.getSyncQueue).toHaveBeenCalledTimes(1);

      // Resolve the drain to let it process all queued items
      resolveQueue([
        {
          id: 'item-1',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm1' },
          mutationId: 'm1',
          createdAt: 100,
          attempts: 0,
        },
      ]);

      await vi.waitFor(() => {
        expect(api.put).toHaveBeenCalled();
      });

      // Still only one drain ran
      expect(db.getSyncQueue).toHaveBeenCalledTimes(1);
    });
  });
});
