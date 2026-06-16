import { describe, expect, it, beforeEach } from 'vitest';
import { useReaderStore } from '../stores/reader';
import { ConflictResolutionStrategy, ConflictType } from '../lib/offline/conflict-resolution';

describe('useReaderStore', () => {
  beforeEach(() => {
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null },
      bookmarks: [],
      highlights: [],
      comments: [],
      currentChapter: null,
      isLoading: false,
      error: null,
      isOffline: false,
      pendingSyncCount: 0,
      permissionStatus: 'checking',
      bookDirection: 'default',
      bookWritingMode: 'horizontal-tb',
      isFixedLayout: false,
      activePanel: null,
      conflicts: [],
    });
  });

  describe('progress', () => {
    it('sets progress', () => {
      const progress = { locator: { cfi: 'cfi-1' }, progressPercent: 50, updatedAt: '2024-01-01' };
      useReaderStore.getState().setProgress(progress);
      expect(useReaderStore.getState().progress).toEqual(progress);
    });
  });

  describe('bookmarks', () => {
    it('adds bookmark', () => {
      const bookmark = { id: '1', locator: { cfi: 'cfi-1' }, label: null, createdAt: '2024-01-01' };
      useReaderStore.getState().addBookmark(bookmark);
      expect(useReaderStore.getState().bookmarks).toHaveLength(1);
      expect(useReaderStore.getState().bookmarks[0]).toEqual(bookmark);
    });

    it('removes bookmark', () => {
      const bookmark = { id: '1', locator: { cfi: 'cfi-1' }, label: null, createdAt: '2024-01-01' };
      useReaderStore.getState().addBookmark(bookmark);
      useReaderStore.getState().removeBookmark('1');
      expect(useReaderStore.getState().bookmarks).toHaveLength(0);
    });

    it('sets bookmarks', () => {
      const bookmarks = [
        { id: '1', locator: { cfi: 'cfi-1' }, label: null, createdAt: '2024-01-01' },
        { id: '2', locator: { cfi: 'cfi-2' }, label: null, createdAt: '2024-01-02' },
      ];
      useReaderStore.getState().setBookmarks(bookmarks);
      expect(useReaderStore.getState().bookmarks).toHaveLength(2);
    });
  });

  describe('highlights', () => {
    it('adds highlight', () => {
      const highlight = {
        id: '1',
        chapterRef: 'ch1',
        cfiRange: 'cfi-range',
        selectedText: 'hello',
        note: null,
        color: '#ff0000',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      useReaderStore.getState().addHighlight(highlight);
      expect(useReaderStore.getState().highlights).toHaveLength(1);
    });

    it('removes highlight', () => {
      const highlight = {
        id: '1',
        chapterRef: 'ch1',
        cfiRange: 'cfi-range',
        selectedText: 'hello',
        note: null,
        color: '#ff0000',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      useReaderStore.getState().addHighlight(highlight);
      useReaderStore.getState().removeHighlight('1');
      expect(useReaderStore.getState().highlights).toHaveLength(0);
    });

    it('sets highlights', () => {
      const highlights = [
        { id: '1', chapterRef: 'ch1', cfiRange: null, selectedText: 'a', note: null, color: '#ff0000', createdAt: '', updatedAt: '' },
      ];
      useReaderStore.getState().setHighlights(highlights);
      expect(useReaderStore.getState().highlights).toHaveLength(1);
    });

    it('updates highlight', () => {
      const highlight = {
        id: '1',
        chapterRef: 'ch1',
        cfiRange: null,
        selectedText: 'hello',
        note: null,
        color: '#ff0000',
        createdAt: '',
        updatedAt: '',
      };
      useReaderStore.getState().addHighlight(highlight);
      useReaderStore.getState().updateHighlight('1', { note: 'Updated note' });
      expect(useReaderStore.getState().highlights[0].note).toBe('Updated note');
    });
  });

  describe('comments', () => {
    it('adds root comment', () => {
      const comment = {
        id: '1',
        userEmail: 'test@example.com',
        chapterRef: null,
        cfiRange: null,
        selectedText: null,
        body: 'Hello!',
        status: 'open' as const,
        visibility: 'shared' as const,
        parentCommentId: null,
        createdAt: '',
        updatedAt: '',
        resolvedAt: null,
      };
      useReaderStore.getState().addComment(comment);
      expect(useReaderStore.getState().comments).toHaveLength(1);
    });

    it('adds reply comment', () => {
      const parent = {
        id: '1',
        userEmail: 'test@example.com',
        chapterRef: null,
        cfiRange: null,
        selectedText: null,
        body: 'Parent',
        status: 'open' as const,
        visibility: 'shared' as const,
        parentCommentId: null,
        createdAt: '',
        updatedAt: '',
        resolvedAt: null,
      };
      const reply = {
        id: '2',
        userEmail: 'test@example.com',
        chapterRef: null,
        cfiRange: null,
        selectedText: null,
        body: 'Reply',
        status: 'open' as const,
        visibility: 'shared' as const,
        parentCommentId: '1',
        createdAt: '',
        updatedAt: '',
        resolvedAt: null,
      };
      useReaderStore.getState().addComment(parent);
      useReaderStore.getState().addComment(reply);
      expect(useReaderStore.getState().comments).toHaveLength(1);
      expect(useReaderStore.getState().comments[0].replies).toHaveLength(1);
    });

    it('updates comment', () => {
      const comment = {
        id: '1',
        userEmail: 'test@example.com',
        chapterRef: null,
        cfiRange: null,
        selectedText: null,
        body: 'Original',
        status: 'open' as const,
        visibility: 'shared' as const,
        parentCommentId: null,
        createdAt: '',
        updatedAt: '',
        resolvedAt: null,
      };
      useReaderStore.getState().addComment(comment);
      useReaderStore.getState().updateComment('1', { body: 'Updated' });
      expect(useReaderStore.getState().comments[0].body).toBe('Updated');
    });

    it('sets comments', () => {
      const comments = [
        { id: '1', userEmail: 'a@b.com', chapterRef: null, cfiRange: null, selectedText: null, body: 'Hi', status: 'open' as const, visibility: 'shared' as const, parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
      ];
      useReaderStore.getState().setComments(comments);
      expect(useReaderStore.getState().comments).toHaveLength(1);
    });
  });

  describe('simple setters', () => {
    it('sets currentChapter', () => {
      useReaderStore.getState().setCurrentChapter('ch1');
      expect(useReaderStore.getState().currentChapter).toBe('ch1');
    });

    it('sets isLoading', () => {
      useReaderStore.getState().setLoading(true);
      expect(useReaderStore.getState().isLoading).toBe(true);
    });

    it('sets error', () => {
      useReaderStore.getState().setError('Something went wrong');
      expect(useReaderStore.getState().error).toBe('Something went wrong');
    });

    it('sets isOffline', () => {
      useReaderStore.getState().setOffline(true);
      expect(useReaderStore.getState().isOffline).toBe(true);
    });

    it('sets pendingSyncCount', () => {
      useReaderStore.getState().setPendingSyncCount(5);
      expect(useReaderStore.getState().pendingSyncCount).toBe(5);
    });

    it('sets permissionStatus', () => {
      useReaderStore.getState().setPermissionStatus('valid');
      expect(useReaderStore.getState().permissionStatus).toBe('valid');
    });

    it('sets bookDirection', () => {
      useReaderStore.getState().setBookDirection('rtl');
      expect(useReaderStore.getState().bookDirection).toBe('rtl');
    });

    it('sets bookWritingMode', () => {
      useReaderStore.getState().setBookWritingMode('vertical-rl');
      expect(useReaderStore.getState().bookWritingMode).toBe('vertical-rl');
    });

    it('sets isFixedLayout', () => {
      useReaderStore.getState().setIsFixedLayout(true);
      expect(useReaderStore.getState().isFixedLayout).toBe(true);
    });

    it('sets activePanel', () => {
      useReaderStore.getState().setActivePanel('toc');
      expect(useReaderStore.getState().activePanel).toBe('toc');
    });

    it('toggles panel', () => {
      useReaderStore.getState().setActivePanel(null);
      useReaderStore.getState().togglePanel('toc');
      expect(useReaderStore.getState().activePanel).toBe('toc');
      useReaderStore.getState().togglePanel('toc');
      expect(useReaderStore.getState().activePanel).toBe(null);
    });
  });

  describe('conflicts', () => {
    it('sets conflicts', () => {
      const conflicts = [
        {
          id: '1',
          type: ConflictType.AnnotationEdit,
          entityId: 'h1',
          localVersion: { id: 'h1' },
          remoteVersion: { id: 'h1', note: 'remote' },
          localTimestamp: Date.now(),
          remoteTimestamp: Date.now(),
          resolved: false,
          resolution: null,
          resolvedAt: null,
          bookId: 'book-1',
          createdAt: Date.now(),
        },
      ];
      useReaderStore.getState().setConflicts(conflicts);
      expect(useReaderStore.getState().conflicts).toHaveLength(1);
    });

    it('adds conflict', () => {
      const conflict = {
        id: '1',
        type: ConflictType.AnnotationEdit,
        entityId: 'h1',
        localVersion: { id: 'h1' },
        remoteVersion: { id: 'h1' },
        localTimestamp: Date.now(),
        remoteTimestamp: Date.now(),
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'book-1',
        createdAt: Date.now(),
      };
      useReaderStore.getState().addConflict(conflict);
      expect(useReaderStore.getState().conflicts).toHaveLength(1);
    });

    it('updates existing conflict', () => {
      const conflict = {
        id: '1',
        type: ConflictType.AnnotationEdit,
        entityId: 'h1',
        localVersion: { id: 'h1' },
        remoteVersion: { id: 'h1' },
        localTimestamp: Date.now(),
        remoteTimestamp: Date.now(),
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'book-1',
        createdAt: Date.now(),
      };
      useReaderStore.getState().addConflict(conflict);
      const updated = { ...conflict, remoteVersion: { id: 'h1', note: 'updated' } };
      useReaderStore.getState().addConflict(updated);
      expect(useReaderStore.getState().conflicts).toHaveLength(1);
    });

    it('resolves conflict', () => {
      const conflict = {
        id: '1',
        type: ConflictType.AnnotationEdit,
        entityId: 'h1',
        localVersion: { id: 'h1', note: 'local' },
        remoteVersion: { id: 'h1', note: 'remote' },
        localTimestamp: Date.now(),
        remoteTimestamp: Date.now(),
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'book-1',
        createdAt: Date.now(),
      };
      useReaderStore.getState().addConflict(conflict);
      const result = useReaderStore.getState().resolveConflict('1', 'local');
      expect(result).toEqual({
        resolved: true,
        strategy: ConflictResolutionStrategy.Manual,
        winner: 'local',
        merged: { id: 'h1', note: 'local' },
      });
      expect(useReaderStore.getState().conflicts[0].resolved).toBe(true);
    });

    it('returns null for already resolved conflict', () => {
      const conflict = {
        id: '1',
        type: ConflictType.AnnotationEdit,
        entityId: 'h1',
        localVersion: { id: 'h1' },
        remoteVersion: { id: 'h1' },
        localTimestamp: Date.now(),
        remoteTimestamp: Date.now(),
        resolved: true,
        resolution: 'local' as const,
        resolvedAt: Date.now(),
        bookId: 'book-1',
        createdAt: Date.now(),
      };
      useReaderStore.getState().addConflict(conflict);
      const result = useReaderStore.getState().resolveConflict('1', 'remote');
      expect(result).toBeNull();
    });

    it('clears conflicts', () => {
      useReaderStore.getState().addConflict({
        id: '1',
        type: ConflictType.AnnotationEdit,
        entityId: 'h1',
        localVersion: {},
        remoteVersion: {},
        localTimestamp: Date.now(),
        remoteTimestamp: Date.now(),
        resolved: false,
        resolution: null,
        resolvedAt: null,
        bookId: 'book-1',
        createdAt: Date.now(),
      });
      useReaderStore.getState().clearConflicts();
      expect(useReaderStore.getState().conflicts).toHaveLength(0);
    });
  });
});
