import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  cachePermission,
  getCachedPermission,
  clearPermissionCache,
  clearAllPermissionCache,
  setTokenOverride,
  type SyncQueueItem,
  type PermissionCache,
} from '../lib/offline/db';

const TEST_TOKEN = 'test-session-token-for-offline-db';

describe('Offline Database — Sync Queue & Permissions', () => {
  beforeEach(async () => {
    setTokenOverride(null);
    const db = await getDB();
    const tx = db.transaction(['progress', 'annotations', 'syncQueue', 'permissions'], 'readwrite');
    await tx.objectStore('progress').clear();
    await tx.objectStore('annotations').clear();
    await tx.objectStore('syncQueue').clear();
    await tx.objectStore('permissions').clear();
    await tx.done;
  });

  afterEach(() => {
    setTokenOverride(null);
  });

  describe('Sync Queue', () => {
    it('should add and retrieve queue items', async () => {
      const item: SyncQueueItem = {
        id: 'item-1',
        type: 'progress',
        payload: { bookId: 'book-1', cfi: '/6/4', percentage: 50 },
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 0,
      };

      await addToSyncQueue(item);
      const queue = await getSyncQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('item-1');
    });

    it('should remove queue items', async () => {
      const item: SyncQueueItem = {
        id: 'item-to-remove',
        type: 'annotation',
        payload: { bookId: 'book-1' },
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 0,
      };

      await addToSyncQueue(item);
      await removeSyncQueueItem('item-to-remove');

      const queue = await getSyncQueue();
      expect(queue).toHaveLength(0);
    });

    it('should update queue items', async () => {
      const item: SyncQueueItem = {
        id: 'item-update',
        type: 'progress',
        payload: {},
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 0,
      };

      await addToSyncQueue(item);

      const updated: SyncQueueItem = {
        ...item,
        attempts: 2,
        lastAttempt: Date.now(),
        error: 'Network error',
      };

      await updateSyncQueueItem(updated);

      const queue = await getSyncQueue();
      expect(queue[0].attempts).toBe(2);
      expect(queue[0].error).toBe('Network error');
    });

    it('should encrypt queue payload when token is set', async () => {
      setTokenOverride(TEST_TOKEN);

      const item: SyncQueueItem = {
        id: 'item-enc',
        type: 'progress',
        payload: { bookId: 'book-1', cfi: '/6/4', percentage: 50, sensitive: 'private-data' },
        mutationId: 'mutation-1',
        createdAt: Date.now(),
        attempts: 0,
      };

      await addToSyncQueue(item);

      const db = await getDB();
      const stored = await db.get('syncQueue', 'item-enc') as Record<string, unknown>;
      expect(stored.encryptedPayload).toBeDefined();
      expect(stored.payload).toBeUndefined();

      const queue = await getSyncQueue();
      expect(queue).toHaveLength(1);
      expect((queue[0].payload as Record<string, unknown>).sensitive).toBe('private-data');
    });
  });

  describe('Permissions', () => {
    it('should cache and retrieve permissions', async () => {
      const permission: PermissionCache = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: false,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      await cachePermission(permission);
      const cached = await getCachedPermission('book-1');

      expect(cached).toBeDefined();
      expect(cached?.grantId).toBe('grant-1');
      expect(cached?.canComment).toBe(true);
    });

    it('should encrypt permission cache when token is set', async () => {
      setTokenOverride(TEST_TOKEN);

      const permission: PermissionCache = {
        bookId: 'book-enc',
        grantId: 'grant-enc',
        canComment: true,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      await cachePermission(permission);

      const db = await getDB();
      const stored = await db.get('permissions', 'book-enc') as Record<string, unknown>;
      expect(stored.encryptedPayload).toBeDefined();
      expect(stored.grantId).toBeUndefined();

      const cached = await getCachedPermission('book-enc');
      expect(cached).toBeDefined();
      expect(cached?.grantId).toBe('grant-enc');
    });

    it('should clear individual permission cache', async () => {
      const perm1: PermissionCache = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      const perm2: PermissionCache = {
        bookId: 'book-2',
        grantId: 'grant-2',
        canComment: false,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      await cachePermission(perm1);
      await cachePermission(perm2);

      await clearPermissionCache('book-1');

      const cached1 = await getCachedPermission('book-1');
      const cached2 = await getCachedPermission('book-2');

      expect(cached1).toBeUndefined();
      expect(cached2).toBeDefined();
    });

    it('should clear all permission cache', async () => {
      const perm1: PermissionCache = {
        bookId: 'book-1',
        grantId: 'grant-1',
        canComment: true,
        canDownloadOffline: false,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      const perm2: PermissionCache = {
        bookId: 'book-2',
        grantId: 'grant-2',
        canComment: true,
        canDownloadOffline: true,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      await cachePermission(perm1);
      await cachePermission(perm2);

      await clearAllPermissionCache();

      const cached1 = await getCachedPermission('book-1');
      const cached2 = await getCachedPermission('book-2');

      expect(cached1).toBeUndefined();
      expect(cached2).toBeUndefined();
    });
  });
});
