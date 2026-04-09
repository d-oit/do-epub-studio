import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDB,
  saveProgress,
  getProgress,
  getUnsyncedProgress,
  saveAnnotation,
  getAnnotations,
  getUnsyncedAnnotations,
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  cachePermission,
  getCachedPermission,
  clearPermissionCache,
  clearAllPermissionCache,
  type ProgressEntry,
  type AnnotationEntry,
  type SyncQueueItem,
  type PermissionCache,
} from '../lib/offline/db';

describe('Offline Database', () => {
  beforeEach(async () => {
    // Clear all stores before each test
    const db = await getDB();
    const tx = db.transaction(['progress', 'annotations', 'syncQueue', 'permissions'], 'readwrite');
    await tx.objectStore('progress').clear();
    await tx.objectStore('annotations').clear();
    await tx.objectStore('syncQueue').clear();
    await tx.objectStore('permissions').clear();
    await tx.done;
  });

  describe('Progress', () => {
    it('should save and retrieve progress', async () => {
      const entry: ProgressEntry = {
        id: 'test-progress-1',
        bookId: 'book-1',
        cfi: '/6/4[chap01ref]!/4/2',
        percentage: 45,
        lastRead: Date.now(),
        synced: false,
        mutationId: 'mutation-1',
      };

      await saveProgress(entry);
      const retrieved = await getProgress('book-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-progress-1');
      expect(retrieved?.percentage).toBe(45);
    });

    it('should return latest progress for a book', async () => {
      const entry1: ProgressEntry = {
        id: 'progress-1',
        bookId: 'book-1',
        cfi: '/6/4',
        percentage: 30,
        lastRead: Date.now() - 1000,
        synced: false,
        mutationId: 'mutation-1',
      };

      const entry2: ProgressEntry = {
        id: 'progress-2',
        bookId: 'book-1',
        cfi: '/6/8',
        percentage: 60,
        lastRead: Date.now(),
        synced: false,
        mutationId: 'mutation-2',
      };

      await saveProgress(entry1);
      await saveProgress(entry2);

      const latest = await getProgress('book-1');
      expect(latest?.percentage).toBe(60);
    });

    it('should return unsynced progress', async () => {
      const synced: ProgressEntry = {
        id: 'synced-1',
        bookId: 'book-1',
        cfi: '/6/4',
        percentage: 50,
        lastRead: Date.now(),
        synced: true,
        mutationId: 'mutation-1',
      };

      const unsynced: ProgressEntry = {
        id: 'unsynced-1',
        bookId: 'book-2',
        cfi: '/6/8',
        percentage: 75,
        lastRead: Date.now(),
        synced: false,
        mutationId: 'mutation-2',
      };

      await saveProgress(synced);
      await saveProgress(unsynced);

      const unsyncedList = await getUnsyncedProgress();
      expect(unsyncedList).toHaveLength(1);
      expect(unsyncedList[0].id).toBe('unsynced-1');
    });
  });

  describe('Annotations', () => {
    it('should save and retrieve annotations', async () => {
      const annotation: AnnotationEntry = {
        id: 'annotation-1',
        bookId: 'book-1',
        type: 'highlight',
        cfi: '/6/4[chap01ref]!/4/2',
        text: 'Test highlight',
        color: '#ffff00',
        chapter: 'Chapter 1',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'mutation-1',
      };

      await saveAnnotation(annotation);
      const annotations = await getAnnotations('book-1');

      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('annotation-1');
    });

    it('should return unsynced annotations', async () => {
      const synced: AnnotationEntry = {
        id: 'synced-ann',
        bookId: 'book-1',
        type: 'comment',
        cfi: '/6/4',
        comment: 'Synced comment',
        createdAt: Date.now(),
        synced: true,
        mutationId: 'mutation-1',
      };

      const unsynced: AnnotationEntry = {
        id: 'unsynced-ann',
        bookId: 'book-1',
        type: 'highlight',
        cfi: '/6/8',
        text: 'Unsynced highlight',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'mutation-2',
      };

      await saveAnnotation(synced);
      await saveAnnotation(unsynced);

      const unsyncedList = await getUnsyncedAnnotations();
      expect(unsyncedList).toHaveLength(1);
      expect(unsyncedList[0].id).toBe('unsynced-ann');
    });
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
