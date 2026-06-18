import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queueSync,
  syncAll,
  setupOnlineListener,
  cancelPendingRetry,
  setPermissionRevokedCallback,
  generateMutationId,
} from './sync';
import * as db from './db';
import { api } from '../api';
import { clearAllPermissions } from './permissions';

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
}));

vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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
    setPermissionRevokedCallback(null as any);
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
      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm1' }, 'm1');
      await vi.waitFor(() => {
        expect(db.addToSyncQueue).toHaveBeenCalled();
      });
    });
  });

  describe('attemptSync', () => {
    it('skips when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      await queueSync('progress', {}, 'm1');
      await new Promise(r => setTimeout(r, 10));
      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });

    it('skips when queue is empty', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);
      await queueSync('progress', {}, 'm1');
      await new Promise(r => setTimeout(r, 10));
      expect(api.post).not.toHaveBeenCalled();
    });

    it('syncs progress item successfully', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-1', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi-1', percentage: 50, mutationId: 'm1' },
        mutationId: 'm1', createdAt: 100, attempts: 0,
      }]);
      vi.mocked(api.post).mockResolvedValue({} as any);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([{
        id: 'p1', bookId: 'b1', cfi: 'cfi-1', percentage: 50, lastRead: 100, synced: false, mutationId: 'm1',
      }]);

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi-1', percentage: 50, mutationId: 'm1' }, 'm1');
      await vi.waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/books/b1/progress', expect.objectContaining({ bookId: 'b1' }));
      });
      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-1');
      });
    });

    it('syncs highlight annotation', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-2', type: 'annotation',
        payload: { bookId: 'b1', annotation: { type: 'highlight', chapter: 'ch1', cfi: 'cfi-2', text: 'hello', color: 'yellow', comment: '' } },
        mutationId: 'm2', createdAt: 200, attempts: 0,
      }]);
      vi.mocked(api.post).mockResolvedValue({} as any);
      vi.mocked(db.getUnsyncedAnnotations).mockResolvedValue([{
        id: 'a1', bookId: 'b1', type: 'highlight', cfi: 'cfi-2', text: 'hello', synced: false, mutationId: 'm2', createdAt: Date.now(),
      }]);

      await queueSync('annotation', { bookId: 'b1', annotation: { type: 'highlight', chapter: 'ch1', cfi: 'cfi-2', text: 'hello', color: 'yellow', comment: '' } }, 'm2');
      await vi.waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/books/b1/highlights', expect.objectContaining({ chapterRef: 'ch1' }));
      });
    });

    it('syncs comment annotation', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-3', type: 'annotation',
        payload: { bookId: 'b1', annotation: { type: 'comment', chapter: 'ch1', cfi: 'cfi-3', text: 'hello', comment: 'my note' } },
        mutationId: 'm3', createdAt: 300, attempts: 0,
      }]);
      vi.mocked(api.post).mockResolvedValue({} as any);
      vi.mocked(db.getUnsyncedAnnotations).mockResolvedValue([{
        id: 'a2', bookId: 'b1', type: 'comment', cfi: 'cfi-3', synced: false, mutationId: 'm3', createdAt: Date.now(),
      }]);

      await queueSync('annotation', { bookId: 'b1', annotation: { type: 'comment', chapter: 'ch1', cfi: 'cfi-3', text: 'hello', comment: 'my note' } }, 'm3');
      await vi.waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/books/b1/comments', expect.objectContaining({ body: 'my note' }));
      });
    });

    it('retries on generic error', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-4', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm4' },
        mutationId: 'm4', createdAt: 400, attempts: 0,
      }]);
      vi.mocked(api.post).mockRejectedValue(new Error('Network error'));

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm4' }, 'm4');
      await vi.waitFor(() => {
        expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
          expect.objectContaining({ attempts: 1, error: 'Network error' }),
        );
      });
    });

    it('handles permission revocation on 401', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-5', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm5' },
        mutationId: 'm5', createdAt: 500, attempts: 0,
      }]);
      const err = Object.assign(new Error('Unauthorized'), { status: 401 });
      vi.mocked(api.post).mockRejectedValue(err);

      const mockCallback = vi.fn();
      setPermissionRevokedCallback(mockCallback);

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm5' }, 'm5');
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
      expect(mockCallback).toHaveBeenCalledWith('b1');
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-5');
    });

    it('handles permission revocation on 403', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-6', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm6' },
        mutationId: 'm6', createdAt: 600, attempts: 0,
      }]);
      vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm6' }, 'm6');
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('handles permission revocation via error message', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-7', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm7' },
        mutationId: 'm7', createdAt: 700, attempts: 0,
      }]);
      vi.mocked(api.post).mockRejectedValue(new Error('permission denied'));

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm7' }, 'm7');
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('handles revoked in error message', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-14', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm14' },
        mutationId: 'm14', createdAt: 1400, attempts: 0,
      }]);
      vi.mocked(api.post).mockRejectedValue(new Error('Session revoked'));

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm14' }, 'm14');
      await vi.waitFor(() => {
        expect(clearAllPermissions).toHaveBeenCalled();
      });
    });

    it('removes item after max retries exceeded', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-8', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' },
        mutationId: 'm8', createdAt: 800, attempts: 5,
      }]);

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm8' }, 'm8');
      await vi.waitFor(() => {
        expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-8');
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('marks progress entry as synced', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-11', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm11' },
        mutationId: 'm11', createdAt: 1100, attempts: 0,
      }]);
      vi.mocked(api.post).mockResolvedValue({} as any);
      vi.mocked(db.getUnsyncedProgress).mockResolvedValue([{
        id: 'p1', bookId: 'b1', cfi: 'cfi', percentage: 50, lastRead: 100, synced: false, mutationId: 'm11',
      }]);

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm11' }, 'm11');
      await vi.waitFor(() => {
        expect(db.saveProgress).toHaveBeenCalledWith(expect.objectContaining({ synced: true }));
      });
    });

    it('marks annotation entry as synced', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-12', type: 'annotation',
        payload: { bookId: 'b1', annotation: { type: 'highlight', chapter: 'ch1', cfi: 'cfi-12', text: 'hi', color: 'yellow', comment: '' } },
        mutationId: 'm12', createdAt: 1200, attempts: 0,
      }]);
      vi.mocked(api.post).mockResolvedValue({} as any);
      vi.mocked(db.getUnsyncedAnnotations).mockResolvedValue([{
        id: 'a1', bookId: 'b1', type: 'highlight', cfi: 'cfi-12', synced: false, mutationId: 'm12', createdAt: Date.now(),
      }]);

      await queueSync('annotation', { bookId: 'b1', annotation: { type: 'highlight', chapter: 'ch1', cfi: 'cfi-12', text: 'hi', color: 'yellow', comment: '' } }, 'm12');
      await vi.waitFor(() => {
        expect(db.saveAnnotation).toHaveBeenCalledWith(expect.objectContaining({ synced: true }));
      });
    });

    it('handles non-Error thrown values', async () => {
      vi.mocked(db.getSyncQueue).mockResolvedValue([{
        id: 'item-15', type: 'progress',
        payload: { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm15' },
        mutationId: 'm15', createdAt: 1500, attempts: 0,
      }]);
      vi.mocked(api.post).mockRejectedValue('string error');

      await queueSync('progress', { bookId: 'b1', cfi: 'cfi', percentage: 50, mutationId: 'm15' }, 'm15');
      await vi.waitFor(() => {
        expect(db.updateSyncQueueItem).toHaveBeenCalled();
      });
    });
  });

  describe('syncAll', () => {
    it('skips when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      await syncAll();
      await new Promise(r => setTimeout(r, 10));
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
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const cleanup = setupOnlineListener();

      window.dispatchEvent(new Event('offline'));
      await new Promise(r => setTimeout(r, 100));
      cleanup();
      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });
  });
});
