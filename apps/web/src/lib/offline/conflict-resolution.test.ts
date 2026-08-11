/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConflictType,
  ConflictResolutionStrategy,
  detectConflict,
  resolveWithLWW,
  resolveConflict,
  getPendingConflicts,
  resolveManualConflict,
  clearResolvedConflicts,
  clearAllConflicts,
  hasPendingConflicts,
  hydrateConflicts,
  flushConflictWrites,
  __clearConflictCache,
} from './conflict-resolution';
import { setTokenOverride, clearConflictsStore, getAllConflicts } from './db';

vi.mock('../client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

describe('Conflict Resolution', () => {
  beforeEach(() => {
    clearAllConflicts();
    vi.clearAllMocks();
  });

  const localVersion = { text: 'local text', color: 'yellow' };
  const remoteVersion = { text: 'remote text', color: 'green' };

  describe('detectConflict', () => {
    it('should detect conflict when timestamps are identical', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'annotation-1',
      );

      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.AnnotationEdit);
      expect(conflict!.localVersion).toEqual(localVersion);
      expect(conflict!.remoteVersion).toEqual(remoteVersion);
      expect(conflict!.resolved).toBe(false);
      expect(conflict!.bookId).toBe('book-1');
      expect(conflict!.entityId).toBe('annotation-1');
    });

    it('should return null when timestamps differ', () => {
      const conflict = detectConflict(
        ConflictType.ProgressUpdate,
        localVersion,
        remoteVersion,
        1000,
        2000,
        'book-1',
        'progress-1',
      );

      expect(conflict).toBeNull();
    });
  });

  describe('resolveWithLWW', () => {
    it('should pick local when local timestamp is newer', () => {
      const result = resolveWithLWW(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        2000,
        1000,
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.LastWriteWins);
      expect(result.winner).toBe('local');
      expect(result.merged).toEqual(localVersion);
    });

    it('should pick remote when remote timestamp is newer', () => {
      const result = resolveWithLWW(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        2000,
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.LastWriteWins);
      expect(result.winner).toBe('remote');
      expect(result.merged).toEqual(remoteVersion);
    });

    it('should pick local when timestamps are equal', () => {
      const result = resolveWithLWW(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.LastWriteWins);
      expect(result.winner).toBe('local');
    });
  });

  describe('resolveConflict', () => {
    it('should use LWW when time difference is within threshold', () => {
      const result = resolveConflict(
        ConflictType.ProgressUpdate,
        localVersion,
        remoteVersion,
        6000,
        5000,
        'book-1',
        'entity-1',
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.LastWriteWins);
      expect(result.winner).toBe('local');
    });

    it('should escalate to manual when timestamps are identical', () => {
      const result = resolveConflict(
        ConflictType.CommentUpdate,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'entity-1',
      );

      expect(result.resolved).toBe(false);
      expect(result.strategy).toBe(ConflictResolutionStrategy.Manual);
    });

    it('should escalate to manual when time difference exceeds threshold', () => {
      const result = resolveConflict(
        ConflictType.BookmarkChange,
        localVersion,
        remoteVersion,
        0,
        10000,
        'book-1',
        'entity-1',
      );

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe(ConflictResolutionStrategy.LastWriteWins);
      expect(result.winner).toBe('remote');
    });
  });

  describe('getPendingConflicts', () => {
    it('should return all unresolved conflicts', () => {
      detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');
      detectConflict(ConflictType.ProgressUpdate, {}, {}, 2000, 2000, 'book-2', 'prog-1');

      const pending = getPendingConflicts();
      expect(pending).toHaveLength(2);
    });

    it('should filter by bookId', () => {
      detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');
      detectConflict(ConflictType.ProgressUpdate, {}, {}, 2000, 2000, 'book-2', 'prog-1');

      const pending = getPendingConflicts('book-1');
      expect(pending).toHaveLength(1);
      expect(pending[0].bookId).toBe('book-1');
    });

    it('should not return resolved conflicts', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1',
      );

      resolveManualConflict(conflict!.id, 'local');

      const pending = getPendingConflicts();
      expect(pending).toHaveLength(0);
    });
  });

  describe('resolveManualConflict', () => {
    it('should resolve with local version', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'ann-1',
      );

      const result = resolveManualConflict(conflict!.id, 'local');
      expect(result).not.toBeNull();
      expect(result!.resolved).toBe(true);
      expect(result!.strategy).toBe(ConflictResolutionStrategy.Manual);
      expect(result!.winner).toBe('local');
      expect(result!.merged).toEqual(localVersion);
    });

    it('should resolve with remote version', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'ann-1',
      );

      const result = resolveManualConflict(conflict!.id, 'remote');
      expect(result).not.toBeNull();
      expect(result!.resolved).toBe(true);
      expect(result!.winner).toBe('remote');
      expect(result!.merged).toEqual(remoteVersion);
    });

    it('should accept merged version', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'ann-1',
      );

      const mergedVersion = { text: 'merged text', color: 'blue' };
      const result = resolveManualConflict(conflict!.id, 'local', mergedVersion);
      expect(result).not.toBeNull();
      expect(result!.resolved).toBe(true);
      expect(result!.merged).toEqual(mergedVersion);
    });

    it('should return null for nonexistent conflict', () => {
      const result = resolveManualConflict('nonexistent', 'local');
      expect(result).toBeNull();
    });

    it('should return null for already resolved conflict', () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1',
      );

      resolveManualConflict(conflict!.id, 'local');
      const result = resolveManualConflict(conflict!.id, 'remote');
      expect(result).toBeNull();
    });
  });

  describe('clearResolvedConflicts', () => {
    it('should remove only resolved conflicts', () => {
      const c1 = detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');
      const c2 = detectConflict(ConflictType.ProgressUpdate, {}, {}, 2000, 2000, 'book-2', 'prog-1');
      resolveManualConflict(c1!.id, 'local');

      clearResolvedConflicts();

      const pending = getPendingConflicts();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(c2!.id);
    });
  });

  describe('clearAllConflicts', () => {
    it('should remove all conflicts', () => {
      detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');
      detectConflict(ConflictType.ProgressUpdate, {}, {}, 2000, 2000, 'book-2', 'prog-1');

      clearAllConflicts();

      expect(getPendingConflicts()).toHaveLength(0);
    });
  });

  describe('hasPendingConflicts', () => {
    it('should return true when conflicts exist', () => {
      detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');

      expect(hasPendingConflicts()).toBe(true);
    });

    it('should return false when no conflicts exist', () => {
      expect(hasPendingConflicts()).toBe(false);
    });

    it('should filter by bookId', () => {
      detectConflict(ConflictType.AnnotationEdit, {}, {}, 1000, 1000, 'book-1', 'ann-1');
      detectConflict(ConflictType.ProgressUpdate, {}, {}, 2000, 2000, 'book-2', 'prog-1');

      expect(hasPendingConflicts('book-1')).toBe(true);
      expect(hasPendingConflicts('book-2')).toBe(true);
      expect(hasPendingConflicts('book-3')).toBe(false);
    });
  });

  describe('conflict persistence (IndexedDB)', () => {
    const TEST_TOKEN = 'test-session-token-for-conflicts';

    beforeEach(async () => {
      setTokenOverride(TEST_TOKEN);
      __clearConflictCache();
      clearAllConflicts();
      await flushConflictWrites(); // drain any queued writes from prior tests
      await clearConflictsStore();
    });

    afterEach(() => {
      setTokenOverride(null);
      __clearConflictCache();
      clearAllConflicts();
    });

    it('round-trips a detected conflict through IndexedDB', async () => {
      const conflict = detectConflict(
        ConflictType.AnnotationEdit,
        localVersion,
        remoteVersion,
        1000,
        1000,
        'book-1',
        'annotation-1',
      );
      expect(conflict).not.toBeNull();
      await flushConflictWrites();

      // Fresh session: clear the in-memory Map, hydrated from the durable store.
      __clearConflictCache();
      await hydrateConflicts();

      const pending = getPendingConflicts('book-1');
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        type: ConflictType.AnnotationEdit,
        bookId: 'book-1',
        entityId: 'annotation-1',
        resolved: false,
      });
      expect(pending[0].localVersion).toEqual(localVersion);
      expect(pending[0].remoteVersion).toEqual(remoteVersion);
    });

    it('purges resolve + clear from the durable store', async () => {
      const conflict = detectConflict(
        ConflictType.ProgressUpdate,
        localVersion,
        remoteVersion,
        2000,
        2000,
        'book-1',
        'progress-1',
      );
      expect(conflict).not.toBeNull();

      resolveManualConflict(conflict!.id, 'local');
      clearResolvedConflicts('book-1');
      await flushConflictWrites();

      // Fresh session: a resolved-and-purged conflict must not resurrect.
      __clearConflictCache();
      await hydrateConflicts();
      expect(getPendingConflicts('book-1')).toHaveLength(0);
      // The durable surface is now empty too — resolve + clear purged it.
      expect(await getAllConflicts()).toHaveLength(0);
    });
  });
});
