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
import { useAuthStore } from '../stores/auth';

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
    getAllCachedPermissions: vi.fn(),
    clearPermissionCache: vi.fn(),
    clearAllPermissionCache: vi.fn(),
  };
});

describe('Offline Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // The permission check resolves the session from the bearer token.
    useAuthStore.setState({ sessionToken: 'permissions-session-token' });
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
          ok: true,
          data: {
            grantId: 'grant-2',
            canComment: true,
            canDownloadOffline: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await validatePermission('book-1');

      expect(api.get).toHaveBeenCalledWith('/api/access/validate?bookId=book-1', {
        headers: { Authorization: 'Bearer permissions-session-token' },
      });
      expect(result.isValid).toBe(true);
      expect(result.canComment).toBe(true);
    });

    it('reads the permission fields out of the worker response envelope', async () => {
      // The worker answers with `{ ok, data }`. Reading the envelope directly
      // made every field `undefined`, so the cache stored an empty grant id
      // and the permission was never really refreshed.
      vi.mocked(db.getCachedPermission).mockResolvedValue(undefined);
      vi.mocked(api.get).mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              grantId: 'grant-9',
              canComment: true,
              canDownloadOffline: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await validatePermission('book-1');

      expect(result.grantId).toBe('grant-9');
      expect(result.canComment).toBe(true);
      expect(result.canDownloadOffline).toBe(false);
      expect(db.cachePermission).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'book-1', grantId: 'grant-9', canComment: true }),
      );
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
      const cleanup = setupZombieDetection('session-token', mockOnRevoked);

      expect(cleanup).toBeInstanceOf(Function);
      cleanup();
    });

    it('should send the current session token to validate-all', async () => {
      vi.mocked(api.get).mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { grantIds: [], revokedBookIds: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(db.getAllCachedPermissions).mockResolvedValue([]);

      const cleanup = setupZombieDetection('session-token', vi.fn());
      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(0);

      expect(api.get).toHaveBeenCalledWith('/api/access/validate-all', {
        headers: { Authorization: 'Bearer session-token' },
      });
      cleanup();
    });

    it('should call onRevoked when grant is revoked', async () => {
      const mockOnRevoked = vi.fn();

      const mockResponse = new Response(
        JSON.stringify({
          ok: true,
          data: {
            grantIds: ['grant-2'],
            revokedBookIds: ['book-1'],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
      vi.mocked(api.get).mockResolvedValue(mockResponse);
      vi.mocked(db.getAllCachedPermissions).mockResolvedValue([
        {
          bookId: 'book-1',
          grantId: 'grant-1',
          canComment: true,
          canDownloadOffline: true,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ]);

      const cleanup = setupZombieDetection('session-token', mockOnRevoked);

      // Advance timer past the 60s interval used by setupZombieDetection
      await vi.advanceTimersByTimeAsync(60000);
      // Allow the async interval callback to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(mockOnRevoked).toHaveBeenCalledWith('book-1');
      expect(db.clearPermissionCache).toHaveBeenCalledWith('book-1');
      cleanup();
    });

    it('detects a revoked grant from the worker response envelope', async () => {
      // The worker's validate-all answers with `{ ok, data }`. Reading the
      // envelope directly made `new Set(undefined)` — an empty set — so every
      // cached grant looked revoked, including healthy ones.
      const mockOnRevoked = vi.fn();
      vi.mocked(api.get).mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              grantIds: ['grant-2'],
              revokedBookIds: ['book-1'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      vi.mocked(db.getAllCachedPermissions).mockResolvedValue([
        {
          bookId: 'book-1',
          grantId: 'grant-1',
          canComment: true,
          canDownloadOffline: true,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ]);

      const cleanup = setupZombieDetection('session-token', mockOnRevoked);
      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockOnRevoked).toHaveBeenCalledWith('book-1');
      cleanup();
    });

    it('does not report a healthy grant as revoked', async () => {
      // The inverse of the case above: a grant the server still lists as
      // valid must survive the poll. With the envelope unread, both sets were
      // empty, so every cached permission was cleared and the reader was told
      // its access had been revoked.
      const mockOnRevoked = vi.fn();
      vi.mocked(api.get).mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              grantIds: ['grant-1'],
              revokedBookIds: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      vi.mocked(db.getAllCachedPermissions).mockResolvedValue([
        {
          bookId: 'book-1',
          grantId: 'grant-1',
          canComment: true,
          canDownloadOffline: true,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ]);

      const cleanup = setupZombieDetection('session-token', mockOnRevoked);
      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockOnRevoked).not.toHaveBeenCalled();
      expect(db.clearPermissionCache).not.toHaveBeenCalled();
      cleanup();
    });

    it('should not check when offline', async () => {
      // Mock navigator.onLine using Object.defineProperty
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const mockOnRevoked = vi.fn();
      const cleanup = setupZombieDetection('session-token', mockOnRevoked);

      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(0);

      // API should not have been called when offline
      expect(api.get).not.toHaveBeenCalled();
      expect(mockOnRevoked).not.toHaveBeenCalled();

      cleanup();
      // Restore original
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'onLine', originalDescriptor);
      }
    });
  });
});
