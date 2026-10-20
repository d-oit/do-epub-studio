import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queueSync,
  syncAll,
  setupOnlineListener,
  cancelPendingRetry,
  generateMutationId,
  resetDrainPromise,
  setPermissionRevokedCallback,
} from './sync';
import {
  resendProgressFromConflict,
  acceptRemoteProgressFromConflict,
} from './progress-conflict-actions';
import * as db from './db';
import type { SyncQueueItem } from './db';
import { api, apiRequest } from '../api';
import { createHighlight } from '../api/annotations';
import { clearAllPermissions } from './permissions';
import {
  ConflictType,
  type ConflictRecord,
  getPendingConflicts,
  clearAllConflicts,
  flushConflictWrites,
} from './conflict-resolution';
import { useAuthStore } from '../../stores/auth';
import { useReaderStore } from '../../stores/reader';

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

vi.mock('./db', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn(),
  getProgress: vi.fn().mockResolvedValue(undefined),
  removeSyncQueueItem: vi.fn(),
  updateSyncQueueItem: vi.fn(),
  getUnsyncedProgress: vi.fn(),
  getUnsyncedAnnotations: vi.fn(),
  saveProgress: vi.fn(),
  saveAnnotation: vi.fn(),
  saveConflicts: vi.fn().mockResolvedValue(undefined),
  getAllConflicts: vi.fn().mockResolvedValue([]),
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
  beforeEach(async () => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    // The replay engine writes to `readerAuth`-protected worker routes, so a
    // drain needs a live session to send a bearer token with.
    useAuthStore.setState({
      sessionToken: 'replay-session-token',
      bookId: 'b1',
      isAuthenticated: true,
    });
    cancelPendingRetry();
    resetDrainPromise();
    setPermissionRevokedCallback(() => {});
    clearAllConflicts();
    await flushConflictWrites();
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
      vi.mocked(apiRequest).mockResolvedValue({
        revision: 1,
        updatedAt: '2025-01-01T00:00:00Z',
      });
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
        expect(apiRequest).toHaveBeenCalledWith('/api/books/b1/progress', {
          method: 'PUT',
          token: 'replay-session-token',
          body: JSON.stringify({
            locator: { cfi: 'cfi-1' },
            progressPercent: 50,
            mutationId: 'm1',
            baseRevision: 0,
          }),
        });
      });
      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-1');
      });
    });
    it('syncs dependent progress mutations in predecessor order', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'child-item',
          type: 'progress',
          payload: {
            bookId: 'b1',
            cfi: 'child-cfi',
            percentage: 80,
            mutationId: 'm-child',
            baseRevision: 0,
            dependsOnMutationId: 'm-parent',
          },
          mutationId: 'm-child',
          createdAt: 100,
          attempts: 0,
        },
        {
          id: 'parent-item',
          type: 'progress',
          payload: {
            bookId: 'b1',
            cfi: 'parent-cfi',
            percentage: 20,
            mutationId: 'm-parent',
            baseRevision: 0,
          },
          mutationId: 'm-parent',
          createdAt: 200,
          attempts: 0,
        },
      ]);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([]);
      vi.mocked(apiRequest)
        .mockResolvedValueOnce({ revision: 1, updatedAt: '2025-01-01T00:00:00Z' })
        .mockResolvedValueOnce({ revision: 2, updatedAt: '2025-01-02T00:00:00Z' });

      await syncAll();

      expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/books/b1/progress', {
        method: 'PUT',
        token: 'replay-session-token',
        body: JSON.stringify({
          locator: { cfi: 'parent-cfi' },
          progressPercent: 20,
          mutationId: 'm-parent',
          baseRevision: 0,
        }),
      });
      expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/books/b1/progress', {
        method: 'PUT',
        token: 'replay-session-token',
        body: JSON.stringify({
          locator: { cfi: 'child-cfi' },
          progressPercent: 80,
          mutationId: 'm-child',
          baseRevision: 0,
          dependsOnMutationId: 'm-parent',
        }),
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
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

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

    it('keeps jittered retry delay within the exponential delay window', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-retry-delay',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'retry-delay' },
          mutationId: 'retry-delay',
          createdAt: 400,
          attempts: 0,
        },
      ]);
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

      const timerSpy = vi.spyOn(globalThis, 'setTimeout');
      try {
        await queueSync(
          'progress',
          { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'retry-delay' },
          'retry-delay',
        );

        await vi.waitFor(
          () =>
            expect(
              timerSpy.mock.calls.some(
                ([, delay]) => typeof delay === 'number' && delay >= 1500 && delay <= 2500,
              ),
            ).toBe(true),
          { timeout: 400, interval: 10 },
        );

        const retryTimer = timerSpy.mock.calls.find(
          ([, delay]) => typeof delay === 'number' && delay >= 1500 && delay <= 2500,
        );
        if (!retryTimer || typeof retryTimer[1] !== 'number') {
          throw new Error('Retry timer was not scheduled');
        }
        const retryDelay = retryTimer[1];
        expect(retryDelay).toBeGreaterThanOrEqual(1500);
        expect(retryDelay).toBeLessThanOrEqual(2500);
      } finally {
        timerSpy.mockRestore();
      }
    });

    it('retains queued work and stops the drain when a session expires', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'expired-session-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm5' },
          mutationId: 'm5',
          createdAt: 500,
          attempts: 0,
        },
        {
          id: 'later-valid-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'later-cfi', percentage: 60, mutationId: 'm-later' },
          mutationId: 'm-later',
          createdAt: 600,
          attempts: 0,
        },
      ]);
      vi.mocked(apiRequest).mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), { status: 401 }),
      );

      await syncAll();

      expect(clearAllPermissions).toHaveBeenCalled();
      expect(db.removeSyncQueueItem).not.toHaveBeenCalled();
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'expired-session-item',
          error: expect.stringContaining('Unauthorized'),
        }),
      );
      expect(db.updateSyncQueueItem).not.toHaveBeenCalledWith(
        expect.objectContaining({ permanentError: true }),
      );
      expect(apiRequest).toHaveBeenCalledTimes(1);
    });

    it('retains a forbidden item as failed and continues with later work', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'forbidden-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'blocked-cfi', percentage: 50, mutationId: 'm6' },
          mutationId: 'm6',
          createdAt: 600,
          attempts: 0,
        },
        {
          id: 'later-valid-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'valid-cfi', percentage: 70, mutationId: 'm7' },
          mutationId: 'm7',
          createdAt: 700,
          attempts: 0,
        },
      ]);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([]);
      vi.mocked(apiRequest)
        .mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
        .mockResolvedValueOnce({ revision: 1, updatedAt: '2025-01-01T00:00:00Z' });
      const mockCallback = vi.fn();
      setPermissionRevokedCallback(mockCallback);

      await syncAll();

      expect(clearAllPermissions).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith('b1');
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'forbidden-item',
          permanentError: true,
          error: 'Forbidden',
        }),
      );
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('later-valid-item');
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });

    it('marks a validation failure and continues with later valid items', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'invalid-progress-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'invalid-cfi', percentage: 150, mutationId: 'm8' },
          mutationId: 'm8',
          createdAt: 800,
          attempts: 0,
        },
        {
          id: 'later-valid-item',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'valid-cfi', percentage: 70, mutationId: 'm9' },
          mutationId: 'm9',
          createdAt: 900,
          attempts: 0,
        },
      ]);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([]);
      vi.mocked(apiRequest)
        .mockRejectedValueOnce(Object.assign(new Error('Invalid progress'), { status: 422 }))
        .mockResolvedValueOnce({ revision: 1, updatedAt: '2025-01-01T00:00:00Z' });

      await syncAll();

      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invalid-progress-item',
          permanentError: true,
          error: 'Invalid progress',
        }),
      );
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('later-valid-item');
      expect(apiRequest).toHaveBeenCalledTimes(2);
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
      vi.mocked(apiRequest).mockRejectedValue(new Error('permission denied'));

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
      vi.mocked(apiRequest).mockRejectedValue(new Error('Access has been revoked or expired'));

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
      vi.mocked(apiRequest).mockRejectedValue(new Error('Session revoked'));

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm14' },
        'm14',
      );
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('retains exhausted items and continues syncing later valid entries', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-8',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' },
          mutationId: 'm8',
          createdAt: 800,
          attempts: 4,
        },
        {
          id: 'item-9',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi-9', percentage: 60, mutationId: 'm9' },
          mutationId: 'm9',
          createdAt: 801,
          attempts: 5,
          error: 'Earlier network error',
        },
        {
          id: 'item-10',
          type: 'progress',
          payload: { bookId: 'b1', cfi: 'cfi-10', percentage: 70, mutationId: 'm10' },
          mutationId: 'm10',
          createdAt: 802,
          attempts: 0,
        },
      ]);
      vi.mocked(apiRequest)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ revision: 1, updatedAt: '2025-01-01T00:00:00Z' });
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([]);

      await queueSync(
        'progress',
        { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' },
        'm8',
      );

      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-10');
      });
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-8',
          attempts: 5,
          permanentError: true,
          error: 'Network error',
        }),
      );
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-9',
          attempts: 5,
          permanentError: true,
          error: 'Earlier network error',
        }),
      );
      expect(db.removeSyncQueueItem).not.toHaveBeenCalledWith('item-8');
      expect(db.removeSyncQueueItem).not.toHaveBeenCalledWith('item-9');
      expect(apiRequest).toHaveBeenCalledTimes(2);
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
      vi.mocked(apiRequest).mockResolvedValue({
        revision: 1,
        updatedAt: '2025-01-01T00:00:00Z',
      });
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
        expect(db.saveProgress).toHaveBeenCalledWith(
          expect.objectContaining({ synced: true, baseRevision: 1 }),
        );
      });
    });

    it('preserves both progress versions for a server-confirmed revision conflict', async () => {
      const item: SyncQueueItem = {
        id: 'progress-conflict-item',
        type: 'progress',
        payload: {
          bookId: 'b1',
          cfi: 'local-cfi',
          percentage: 35,
          mutationId: 'mutation-local',
          baseRevision: 0,
        },
        mutationId: 'mutation-local',
        createdAt: 1000,
        attempts: 0,
      };
      vi.mocked(db.getSyncQueue).mockResolvedValue([item]);
      vi.mocked(apiRequest)
        .mockRejectedValueOnce(Object.assign(new Error('Revision conflict'), { status: 409 }))
        .mockResolvedValueOnce({
          locator: { cfi: 'remote-cfi' },
          progressPercent: 80,
          updatedAt: new Date(6000).toISOString(),
          revision: 1,
        });

      await queueSync('progress', item.payload, item.mutationId);

      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith(item.id);
      });
      await flushConflictWrites();

      // The conflict read hits the `readerAuth`-protected progress route, so
      // it must carry the session token.
      expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/books/b1/progress', {
        token: 'replay-session-token',
      });

      const [conflict] = getPendingConflicts('b1');
      expect(conflict).toMatchObject({
        type: ConflictType.ProgressUpdate,
        localVersion: item.payload,
        remoteVersion: {
          bookId: 'b1',
          cfi: 'remote-cfi',
          percentage: 80,
          revision: 1,
        },
        resolved: false,
      });
    });
    it('retains the local queue item when conflict details cannot be persisted', async () => {
      const item: SyncQueueItem = {
        id: 'progress-conflict-storage-failure',
        type: 'progress',
        payload: {
          bookId: 'b1',
          cfi: 'local-cfi',
          percentage: 35,
          mutationId: 'mutation-local',
          baseRevision: 0,
        },
        mutationId: 'mutation-local',
        createdAt: 1000,
        attempts: 0,
      };
      vi.mocked(db.getSyncQueue).mockResolvedValue([item]);
      vi.mocked(db.saveConflicts).mockRejectedValueOnce(new Error('IndexedDB quota'));
      vi.mocked(apiRequest)
        .mockRejectedValueOnce(Object.assign(new Error('Revision conflict'), { status: 409 }))
        .mockResolvedValueOnce({
          locator: { cfi: 'remote-cfi' },
          progressPercent: 80,
          updatedAt: new Date(6000).toISOString(),
          revision: 1,
        });

      await syncAll();

      expect(db.removeSyncQueueItem).not.toHaveBeenCalledWith(item.id);
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: item.id,
          permanentError: true,
          error: expect.stringContaining('remains available'),
        }),
      );
    });

    it('applies the chosen remote progress to the reader and encrypted cache', async () => {
      const localEntry = {
        id: 'b1-progress',
        bookId: 'b1',
        cfi: 'local-cfi',
        percentage: 35,
        lastRead: 100,
        synced: false,
        mutationId: 'mutation-local',
        baseRevision: 0,
      };
      const conflict: ConflictRecord = {
        id: 'remote-choice',
        type: ConflictType.ProgressUpdate,
        localVersion: {
          bookId: 'b1',
          cfi: 'local-cfi',
          percentage: 35,
          mutationId: 'mutation-local',
          baseRevision: 0,
        },
        remoteVersion: {
          bookId: 'b1',
          cfi: 'remote-cfi',
          percentage: 80,
          revision: 2,
          updatedAt: '2025-01-02T00:00:00Z',
        },
        localTimestamp: 1000,
        remoteTimestamp: 2000,
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'b1',
        entityId: 'b1',
        createdAt: 2000,
      };
      vi.mocked(db.getProgress).mockResolvedValue(localEntry);
      useAuthStore.setState({ bookId: 'b1' });
      useReaderStore.setState({
        progress: {
          locator: { cfi: 'local-cfi' },
          progressPercent: 35,
          updatedAt: '2025-01-01T00:00:00Z',
          revision: 0,
        },
      });

      await acceptRemoteProgressFromConflict(conflict);

      expect(useReaderStore.getState().progress).toEqual({
        locator: { cfi: 'remote-cfi' },
        progressPercent: 80,
        updatedAt: '2025-01-02T00:00:00Z',
        revision: 2,
      });
      expect(db.saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          cfi: 'remote-cfi',
          percentage: 80,
          baseRevision: 2,
          synced: true,
        }),
      );
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
          token: 'replay-session-token',
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
      vi.mocked(apiRequest).mockRejectedValue('string error');

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
        remoteVersion: {
          bookId: 'b1',
          cfi: 'remote-cfi',
          percentage: 90,
          revision: 3,
          updatedAt: '2025-01-01T00:00:00Z',
        },
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
          payload: {
            bookId: 'b1',
            cfi: 'cfi-9',
            percentage: 42,
            mutationId: 'm9',
            baseRevision: 3,
          },
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
      vi.mocked(apiRequest).mockResolvedValue({
        revision: 1,
        updatedAt: '2025-01-01T00:00:00Z',
      });
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
        expect(apiRequest).toHaveBeenCalled();
      });

      // Still only one drain ran
      expect(db.getSyncQueue).toHaveBeenCalledTimes(1);
    });
  });
});
