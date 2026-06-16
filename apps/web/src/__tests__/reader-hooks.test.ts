import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRelocatedHandler } from '../features/reader/hooks/useEpubProgress';
import { useExportNotes } from '../features/reader/hooks/useExportNotes';
import { useBookmarkHandlers } from '../features/reader/hooks/useBookmarkHandlers';
import { useAnnotationHandlers } from '../features/reader/hooks/useAnnotationHandlers';
import { useReaderHandlers } from '../features/reader/hooks/useReaderHandlers';
import { useReaderStore } from '../stores';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('../lib/offline', () => ({
  saveProgress: vi.fn().mockResolvedValue(undefined),
  saveAnnotation: vi.fn().mockResolvedValue(undefined),
  queueSync: vi.fn().mockResolvedValue(undefined),
  generateMutationId: vi.fn().mockReturnValue('test-mutation-id'),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('../lib/api/annotations', () => ({
  createHighlight: vi.fn().mockResolvedValue({ id: 'h1', color: '#ff0000', selectedText: 'test' }),
  createComment: vi.fn().mockResolvedValue({ id: 'c1', body: 'test', status: 'open' }),
  updateHighlight: vi.fn().mockResolvedValue({ id: 'h1' }),
  deleteHighlight: vi.fn().mockResolvedValue(undefined),
  updateComment: vi.fn().mockResolvedValue({ id: 'c1' }),
}));

import { apiRequest } from '../lib/api';
import { saveProgress, queueSync } from '../lib/offline';
import { createHighlight, createComment, updateComment, deleteHighlight, updateHighlight } from '../lib/api/annotations';

describe('createRelocatedHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null },
      currentChapter: null,
    });
  });

  it('creates handler function', () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
    );

    expect(typeof handler).toBe('function');
  });

  it('saves progress when online', async () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
    );

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    await handler({ start: { cfi: 'epubcfi(/6/4)', progress: 50, href: 'ch1.xhtml' } });

    expect(setProgress).toHaveBeenCalled();
    expect(onChapterChange).toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalled();
  });

  it('queues offline when offline', async () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
    );

    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    await handler({ start: { cfi: 'epubcfi(/6/4)', progress: 50, href: 'ch1.xhtml' } });

    expect(saveProgress).toHaveBeenCalled();
    expect(queueSync).toHaveBeenCalled();
  });

  it('queues offline when API fails', async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Network error'));
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
    );

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    await handler({ start: { cfi: 'epubcfi(/6/4)', progress: 50, href: 'ch1.xhtml' } });

    expect(saveProgress).toHaveBeenCalled();
  });

  it('updates chapter when toc item found', async () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }, { href: 'ch2.xhtml' }],
      currentChapterRef,
      onChapterChange,
    );

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    await handler({ start: { cfi: 'epubcfi(/6/4)', progress: 50, href: 'ch2.xhtml' } });

    expect(setCurrentChapter).toHaveBeenCalledWith('ch2.xhtml');
    expect(currentChapterRef.current).toBe('ch2.xhtml');
  });
});

describe('useExportNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({
      highlights: [
        { id: 'h1', selectedText: 'highlighted text', color: '#ff0000', note: 'My note', chapterRef: null, cfiRange: null, createdAt: '', updatedAt: '' },
      ],
      comments: [
        { id: 'c1', body: 'Great point!', status: 'open', selectedText: 'some text', userEmail: 'a@b.com', chapterRef: null, cfiRange: null, visibility: 'shared', parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
        { id: 'c2', body: 'Deleted', status: 'deleted', selectedText: null, userEmail: 'a@b.com', chapterRef: null, cfiRange: null, visibility: 'shared', parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
      ],
    });
  });

  it('returns handleExportNotes function', () => {
    const { result } = renderHook(() => useExportNotes());
    expect(typeof result.current.handleExportNotes).toBe('function');
  });

  it('exports notes as markdown', () => {
    const { result } = renderHook(() => useExportNotes());
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick, href: '', download: '' } as unknown as HTMLAnchorElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    result.current.handleExportNotes('My Book');

    expect(mockClick).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

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
      comments: [{ id: 'c1', status: 'open' } as any],
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

describe('useReaderHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'token-123', bookId: 'book-1' });
    useReaderStore.setState({
      highlights: [],
      comments: [],
    });
  });

  it('creates highlight', async () => {
    const { result } = renderHook(() => useReaderHandlers());
    const selection = { chapterRef: 'ch1', cfiRange: 'cfi', text: 'selected', rect: new DOMRect() };
    const setSelection = vi.fn();

    await act(async () => {
      await result.current.handleCreateHighlight('#ff0000', selection, setSelection);
    });

    expect(createHighlight).toHaveBeenCalled();
    expect(setSelection).toHaveBeenCalledWith(null);
  });

  it('does not create highlight without selection', async () => {
    const { result } = renderHook(() => useReaderHandlers());
    const setSelection = vi.fn();

    await act(async () => {
      await result.current.handleCreateHighlight('#ff0000', null, setSelection);
    });

    expect(createHighlight).not.toHaveBeenCalled();
  });

  it('creates comment', async () => {
    const { result } = renderHook(() => useReaderHandlers());
    const selection = { chapterRef: 'ch1', cfiRange: 'cfi', text: 'selected', rect: new DOMRect() };
    const setSelection = vi.fn();
    const setShowCommentInput = vi.fn();
    const setIsCommentMode = vi.fn();

    await act(async () => {
      await result.current.handleCreateComment('Great!', selection, setSelection, setShowCommentInput, setIsCommentMode);
    });

    expect(createComment).toHaveBeenCalled();
    expect(setSelection).toHaveBeenCalledWith(null);
    expect(setShowCommentInput).toHaveBeenCalledWith(false);
    expect(setIsCommentMode).toHaveBeenCalledWith(false);
  });

  it('does not create comment without selection', async () => {
    const { result } = renderHook(() => useReaderHandlers());
    const setSelection = vi.fn();
    const setShowCommentInput = vi.fn();
    const setIsCommentMode = vi.fn();

    await act(async () => {
      await result.current.handleCreateComment('Great!', null, setSelection, setShowCommentInput, setIsCommentMode);
    });

    expect(createComment).not.toHaveBeenCalled();
  });

  it('resolves comment', async () => {
    useReaderStore.setState({
      comments: [{ id: 'c1', status: 'open' } as any],
    });
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleResolveComment('c1');
    });

    expect(updateComment).toHaveBeenCalled();
  });

  it('replies to comment', async () => {
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleReplyToComment('parent-1', 'Reply text');
    });

    expect(createComment).toHaveBeenCalled();
  });

  it('edits comment', async () => {
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleEditComment('c1', 'Updated text');
    });

    expect(updateComment).toHaveBeenCalled();
  });

  it('deletes comment', async () => {
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleDeleteComment('c1');
    });

    expect(updateComment).toHaveBeenCalled();
  });

  it('edits highlight', async () => {
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleEditHighlight('h1', 'Updated note');
    });

    expect(updateHighlight).toHaveBeenCalled();
  });

  it('deletes highlight', async () => {
    const { result } = renderHook(() => useReaderHandlers());

    await act(async () => {
      await result.current.handleDeleteHighlight('h1');
    });

    expect(deleteHighlight).toHaveBeenCalled();
  });
});
