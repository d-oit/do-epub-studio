/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateMutationId,
  queueSync,
  syncAll,
  setupOnlineListener,
  setPermissionRevokedCallback,
} from '../lib/offline/sync';
import * as db from '../lib/offline/db';
import { api } from '../lib/api';

// Mock the API
vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock the database
vi.mock('../lib/offline/db', async () => {
  const actual = await vi.importActual('../lib/offline/db');
  return {
    ...actual,
    addToSyncQueue: vi.fn(),
    getSyncQueue: vi.fn(),
    removeSyncQueueItem: vi.fn(),
    updateSyncQueueItem: vi.fn(),
    getUnsyncedProgress: vi.fn(),
    getUnsyncedAnnotations: vi.fn(),
    saveProgress: vi.fn(),
    saveAnnotation: vi.fn(),
    clearAllPermissionCache: vi.fn(),
  };
});

describe('Offline Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock navigator.onLine
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
    
    // Mock window event listeners
    const listeners: Map<string, ((...args: any[]) => void)[]> = new Map();
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn((event: string, handler: (...args: any[]) => void) => {
          const handlers = listeners.get(event) || [];
          handlers.push(handler);
          listeners.set(event, handlers);
        }),
        removeEventListener: vi.fn((event: string, handler: (...args: any[]) => void) => {
          const handlers = listeners.get(event) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) handlers.splice(index, 1);
          listeners.set(event, handlers);
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('generateMutationId', () => {
    it('should generate a valid UUID', () => {
      const id = generateMutationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique IDs', () => {
      const id1 = generateMutationId();
      const id2 = generateMutationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('queueSync', () => {
    it('should add item to sync queue', async () => {
      await queueSync('progress', { bookId: 'book-1' }, 'mutation-1');

      expect(db.addToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          payload: { bookId: 'book-1' },
          mutationId: 'mutation-1',
          attempts: 0,
        }),
      );
    });
  });

  describe('syncAll', () => {
    it('should not sync when offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      await syncAll();

      expect(db.getSyncQueue).not.toHaveBeenCalled();
    });

    it('should process queue when online', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      vi.mocked(db.getSyncQueue).mockResolvedValue([]);

      await syncAll();

      expect(db.getSyncQueue).toHaveBeenCalled();
    });
  });

  describe('setupOnlineListener', () => {
    it('should add event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      const cleanup = setupOnlineListener();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      
      cleanup();
    });

    it('should cleanup event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const cleanup = setupOnlineListener();
      cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Permission Revocation Callback', () => {
    it('should call the callback when permission is revoked', async () => {
      const mockCallback = vi.fn();
      setPermissionRevokedCallback(mockCallback);

      // Simulate a scenario where sync detects revocation
      vi.mocked(db.getSyncQueue).mockResolvedValue([
        {
          id: 'item-1',
          type: 'progress' as const,
          payload: { bookId: 'book-1', cfi: '/6/4', percentage: 50, mutationId: 'mutation-1' },
          mutationId: 'mutation-1',
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      // Mock API to return 403 (permission revoked)
      vi.mocked(api.post).mockRejectedValueOnce({ status: 403, message: 'Permission revoked' });

      // Trigger sync - note: the callback will be invoked asynchronously
      await syncAll();

      // Advance timers to allow retry logic
      await vi.advanceTimersByTimeAsync(1000);

      // The callback should be registered (actual invocation depends on async timing)
       expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      
      const errorItem = {
        id: 'error-item',
        type: 'progress' as const,
        payload: { bookId: 'book-1' },
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 0,
      };

      vi.mocked(db.getSyncQueue).mockResolvedValue([errorItem]);
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(syncAll()).resolves.not.toThrow();

      // Should update the item with error
      expect(db.updateSyncQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'error-item',
          attempts: 1,
          error: expect.any(String),
        }),
      );
    });

    it('should stop retrying after max attempts', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      
      const maxRetryItem = {
        id: 'max-retry-item',
        type: 'progress' as const,
        payload: { bookId: 'book-1' },
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 5, // Already at max
      };

      vi.mocked(db.getSyncQueue).mockResolvedValue([maxRetryItem]);

      await syncAll();

      // Should remove item without attempting sync
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('max-retry-item');
      expect(api.post).not.toHaveBeenCalled();
    });
  });
});
