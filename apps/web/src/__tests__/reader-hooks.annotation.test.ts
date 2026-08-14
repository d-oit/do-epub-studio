import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookmarkHandlers } from '../features/reader/hooks/useBookmarkHandlers';
import { useAnnotationHandlers } from '../features/reader/hooks/useAnnotationHandlers';
import { useReaderStore } from '../stores';
import { useAuthStore } from '../stores/auth';
import type { Comment } from '../stores/reader';

vi.mock('../lib/api/annotations', () => ({
  createHighlight: vi.fn().mockResolvedValue({ id: 'h1', color: '#ff0000', selectedText: 'test' }),
  createComment: vi.fn().mockResolvedValue({ id: 'c1', body: 'test', status: 'open' }),
  updateHighlight: vi.fn().mockResolvedValue({ id: 'h1' }),
  deleteHighlight: vi.fn().mockResolvedValue(undefined),
  updateComment: vi.fn().mockResolvedValue({ id: 'c1' }),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

import { createHighlight, createComment, updateComment, deleteHighlight, updateHighlight } from '../lib/api/annotations';

describe('useBookmarkHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'token-123', bookId: 'book-1' });
    useReaderStore.setState({
      progress: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 50, updatedAt: null },
      bookmarks: [],
    });
  });

  it('creates bookmark', async () => {
    const { result } = renderHook(() => useBookmarkHandlers());
    const currentChapterRef = { current: 'ch1.xhtml' };
    const toc = [{ label: 'Chapter 1', href: 'ch1.xhtml' }];

    await act(async () => {
      await result.current.handleCreateBookmark(currentChapterRef, toc);
    });

    expect(useReaderStore.getState().bookmarks).toHaveLength(1);
  });

  it('does not create bookmark without session token', async () => {
    useAuthStore.setState({ sessionToken: null });
    const { result } = renderHook(() => useBookmarkHandlers());
    const currentChapterRef = { current: null };
    const toc: { label: string; href: string }[] = [];

    await act(async () => {
      await result.current.handleCreateBookmark(currentChapterRef, toc);
    });

    expect(useReaderStore.getState().bookmarks).toHaveLength(0);
  });

  it('deletes bookmark', () => {
    useReaderStore.setState({
      bookmarks: [{ id: 'b1', locator: { cfi: 'cfi' }, label: null, createdAt: '' }],
    });
    const { result } = renderHook(() => useBookmarkHandlers());

    act(() => {
      result.current.handleDeleteBookmark('b1');
    });

    expect(useReaderStore.getState().bookmarks).toHaveLength(0);
  });
});

describe('useAnnotationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'token-123', bookId: 'book-1' });
    useReaderStore.setState({
      highlights: [],
      comments: [],
    });
  });

  it('creates highlight', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());
    const selection = { chapterRef: 'ch1', cfiRange: 'cfi', text: 'selected', rect: new DOMRect() };

    await act(async () => {
      await result.current.handleCreateHighlight('#ff0000', selection);
    });

    expect(createHighlight).toHaveBeenCalled();
  });

  it('does not create highlight without selection', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleCreateHighlight('#ff0000', null);
    });

    expect(createHighlight).not.toHaveBeenCalled();
  });

  it('creates comment', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());
    const selection = { chapterRef: 'ch1', cfiRange: 'cfi', text: 'selected', rect: new DOMRect() };

    await act(async () => {
      await result.current.handleCreateComment('Great!', selection);
    });

    expect(createComment).toHaveBeenCalled();
  });

  it('does not create comment without selection', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleCreateComment('Great!', null);
    });

    expect(createComment).not.toHaveBeenCalled();
  });

  it('resolves comment', async () => {
    useReaderStore.setState({
      comments: [{ id: 'c1', status: 'open' } as unknown as Comment],
    });
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleResolveComment('c1');
    });

    expect(updateComment).toHaveBeenCalledWith('c1', { status: 'resolved' }, 'token-123');
  });

  it('replies to comment', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleReplyToComment('parent-1', 'Reply text');
    });

    expect(createComment).toHaveBeenCalledWith('book-1', { body: 'Reply text', parentCommentId: 'parent-1' }, 'token-123');
  });

  it('edits comment', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleEditComment('c1', 'Updated text');
    });

    expect(updateComment).toHaveBeenCalledWith('c1', { body: 'Updated text' }, 'token-123');
  });

  it('deletes comment', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleDeleteComment('c1');
    });

    expect(updateComment).toHaveBeenCalledWith('c1', { status: 'deleted' }, 'token-123');
  });

  it('edits highlight', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleEditHighlight('h1', 'Updated note');
    });

    expect(updateHighlight).toHaveBeenCalledWith('book-1', 'h1', { note: 'Updated note' }, 'token-123');
  });

  it('deletes highlight', async () => {
    const { result } = renderHook(() => useAnnotationHandlers());

    await act(async () => {
      await result.current.handleDeleteHighlight('h1');
    });

    expect(deleteHighlight).toHaveBeenCalledWith('book-1', 'h1', 'token-123');
  });
});

