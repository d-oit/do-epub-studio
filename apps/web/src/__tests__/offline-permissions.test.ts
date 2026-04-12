/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validatePermission,
  getValidPermission,
  revokePermission,
  clearAllPermissions,
  setupZombieDetection,
} from '../lib/offline/permissions';
import * as db from '../lib/offline/db';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../lib/offline/db', async () => {
  const actual = await vi.importActual('../lib/offline/db');
  return {
    ...actual,
    cachePermission: vi.fn(),
    getCachedPermission: vi.fn(),
    clearPermissionCache: vi.fn(),
    clearAllPermissionCache: vi.fn(),
  };
});

describe('Offline Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validatePermission', () => {
    it('should return cached permission if not expired', async () => {
      const cachedPerm = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: false,
        cachedAt: Date.now() - 1000,
        expiresAt: Date.now() + 86400000, // 24 hours from now
      };

      vi.mocked(db.getCachedPermission).mockResolvedValue(cachedPerm);

      const result = await validatePermission('book-1');

      expect(result.isValid).toBe(true);
      expect(result.canComment).toBe(true);
      expect(api.get).not.toHaveBeenCalled();
    });

    it('should fetch from API if cache is expired', async () => {
      const expiredPerm = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: false,
        canDownloadOffline: true,
        cachedAt: Date.now() - 90000000, // Expired
        expiresAt: Date.now() - 1000,
      };

      vi.mocked(db.getCachedPermission).mockResolvedValue(expiredPerm);
      
      const mockResponse = new Response(
        JSON.stringify({
          grantId: 'grant-2',
          canComment: true,
          canDownloadOffline: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await validatePermission('book-1');

      expect(api.get).toHaveBeenCalledWith('/api/access/validate?bookId=book-1');
      expect(result.isValid).toBe(true);
      expect(result.canComment).toBe(true);
    });

    it('should return invalid if API fails and no cache', async () => {
      vi.mocked(db.getCachedPermission).mockResolvedValue(undefined);
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const result = await validatePermission('book-1');

      expect(result.isValid).toBe(false);
      expect(result.canComment).toBe(false);
    });

    it('should return cached permission if API fails but cache exists', async () => {
      const cachedPerm = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: false,
        cachedAt: Date.now() - 90000000,
        expiresAt: Date.now() - 1000,
      };

      vi.mocked(db.getCachedPermission).mockResolvedValue(cachedPerm);
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const result = await validatePermission('book-1');

      expect(result.isValid).toBe(false); // Cache is expired
      expect(result.canComment).toBe(true); // But still return cached data
    });
  });

  describe('getValidPermission', () => {
    it('should return null if permission is invalid', async () => {
      vi.mocked(db.getCachedPermission).mockResolvedValue(undefined);
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      const result = await getValidPermission('book-1');

      expect(result).toBeNull();
    });

    it('should return permission if valid', async () => {
      const cachedPerm = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      vi.mocked(db.getCachedPermission).mockResolvedValue(cachedPerm);

      const result = await getValidPermission('book-1');

      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(true);
    });
  });

  describe('revokePermission', () => {
    it('should clear permission cache for book', async () => {
      await revokePermission('book-1');

      expect(db.clearPermissionCache).toHaveBeenCalledWith('book-1');
    });
  });

  describe('clearAllPermissions', () => {
    it('should clear all permission caches', async () => {
      await clearAllPermissions();

      expect(db.clearAllPermissionCache).toHaveBeenCalled();
    });
  });

  describe('setupZombieDetection', () => {
    it('should return cleanup function', () => {
      const mockOnRevoked = vi.fn();
      const cleanup = setupZombieDetection(mockOnRevoked);
      
      expect(cleanup).toBeInstanceOf(Function);
      cleanup();
    });

    it('should call onRevoked when grant is revoked', async () => {
      const mockOnRevoked = vi.fn();

      const mockResponse = new Response(
        JSON.stringify({
          grantIds: ['grant-2'],
          revokedBookIds: ['book-1'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      vi.mocked(api.get).mockResolvedValue(mockResponse);
      vi.mocked(db.getCachedPermission).mockResolvedValue({
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      setupZombieDetection(mockOnRevoked);

      // Advance timer past the 60s interval used by setupZombieDetection
      await vi.advanceTimersByTimeAsync(60000);
      // Allow the async interval callback to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(mockOnRevoked).toHaveBeenCalledWith('book-1');
      expect(db.clearPermissionCache).toHaveBeenCalledWith('book-1');
    });

    it('should not check when offline', async () => {
      // Mock navigator.onLine using Object.defineProperty
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const mockOnRevoked = vi.fn();
      setupZombieDetection(mockOnRevoked);

      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(0);

      // API should not have been called when offline
      expect(api.get).not.toHaveBeenCalled();
      expect(mockOnRevoked).not.toHaveBeenCalled();

      // Restore original
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'onLine', originalDescriptor);
      }
    });
  });
});
