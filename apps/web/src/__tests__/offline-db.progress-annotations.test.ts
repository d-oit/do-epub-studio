import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  saveProgress,
  getProgress,
  getUnsyncedProgress,
  saveAnnotation,
  getAnnotations,
  getUnsyncedAnnotations,
  setTokenOverride,
  type ProgressEntry,
  type AnnotationEntry,
} from '../lib/offline/db';

const TEST_TOKEN = 'test-session-token-for-offline-db';
const TEST_TOKEN_2 = 'different-session-token-for-offline-db';

describe('Offline Database — Progress & Annotations', () => {
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

  describe('Progress', () => {
    it('should save and retrieve progress without encryption', async () => {
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

    it('should save and retrieve progress with encryption', async () => {
      setTokenOverride(TEST_TOKEN);

      const entry: ProgressEntry = {
        id: 'test-progress-enc',
        bookId: 'book-1',
        cfi: '/6/4[chap01ref]!/4/2',
        percentage: 45,
        lastRead: Date.now() - 500,
        synced: false,
        mutationId: 'mutation-1',
      };

      await saveProgress(entry);
      const db = await getDB();
      const stored = await db.get('progress', 'test-progress-enc') as Record<string, unknown>;

      expect(stored.encryptedPayload).toBeDefined();
      expect(typeof stored.encryptedPayload).toBe('string');
      expect(stored.cfi).toBeUndefined();

      const retrieved = await getProgress('book-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-progress-enc');
      expect(retrieved?.percentage).toBe(45);
      expect(retrieved?.cfi).toBe('/6/4[chap01ref]!/4/2');
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

    it('should gracefully handle key rotation: old encrypted entry is skipped with new token', async () => {
      setTokenOverride(TEST_TOKEN);
      const entry: ProgressEntry = {
        id: 'key-rotate-old',
        bookId: 'book-1',
        cfi: '/6/4',
        percentage: 50,
        lastRead: Date.now() - 2000,
        synced: false,
        mutationId: 'mutation-1',
      };
      await saveProgress(entry);

      const retrieved1 = await getProgress('book-1');
      expect(retrieved1?.percentage).toBe(50);

      setTokenOverride(TEST_TOKEN_2);
      const entry2: ProgressEntry = {
        id: 'key-rotate-new',
        bookId: 'book-1',
        cfi: '/6/8',
        percentage: 75,
        lastRead: Date.now(),
        synced: false,
        mutationId: 'mutation-2',
      };
      await saveProgress(entry2);

      const retrieved2 = await getProgress('book-1');
      expect(retrieved2).toBeDefined();
      expect(retrieved2?.id).toBe('key-rotate-new');
      expect(retrieved2?.percentage).toBe(75);
    });
  });

  describe('Annotations', () => {
    it('should save and retrieve annotations with encryption', async () => {
      setTokenOverride(TEST_TOKEN);

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

      const db = await getDB();
      const stored = await db.get('annotations', 'annotation-1') as Record<string, unknown>;
      expect(stored.encryptedPayload).toBeDefined();
      expect(stored.text).toBeUndefined();

      const annotations = await getAnnotations('book-1');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('annotation-1');
      expect(annotations[0].text).toBe('Test highlight');
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

  describe('Annotation status/visibility (Plan 998)', () => {
    it('should save and retrieve annotation with status and visibility', async () => {
      const entry: AnnotationEntry = {
        id: 'status-ann-1',
        bookId: 'book-1',
        type: 'comment',
        cfi: '/6/4',
        comment: 'Resolved comment',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'mutation-status-1',
        status: 'resolved',
        visibility: 'shared',
      };

      await saveAnnotation(entry);
      const annotations = await getAnnotations('book-1');
      const found = annotations.find((a) => a.id === 'status-ann-1');

      expect(found).toBeDefined();
      expect(found?.status).toBe('resolved');
      expect(found?.visibility).toBe('shared');
    });

    it('should handle annotations without status/visibility (legacy)', async () => {
      const entry: AnnotationEntry = {
        id: 'legacy-ann-1',
        bookId: 'book-1',
        type: 'comment',
        cfi: '/6/4',
        comment: 'Legacy comment',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'mutation-legacy-1',
      };

      await saveAnnotation(entry);
      const annotations = await getAnnotations('book-1');
      const found = annotations.find((a) => a.id === 'legacy-ann-1');

      expect(found).toBeDefined();
      expect(found?.status).toBeUndefined();
      expect(found?.visibility).toBeUndefined();
    });

    it('should update annotation status from open to resolved', async () => {
      const open: AnnotationEntry = {
        id: 'status-update-1',
        bookId: 'book-1',
        type: 'comment',
        cfi: '/6/4',
        comment: 'Will be resolved',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'mutation-su-1',
        status: 'open',
        visibility: 'shared',
      };

      await saveAnnotation(open);

      const resolved: AnnotationEntry = {
        ...open,
        synced: false,
        mutationId: 'mutation-su-2',
        status: 'resolved',
      };

      await saveAnnotation(resolved);
      const annotations = await getAnnotations('book-1');
      const found = annotations.find((a) => a.id === 'status-update-1');

      expect(found).toBeDefined();
      expect(found?.status).toBe('resolved');
    });
  });
});