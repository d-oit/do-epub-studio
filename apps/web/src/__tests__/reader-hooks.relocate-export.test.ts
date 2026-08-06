import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRelocatedHandler } from '../features/reader/hooks/useEpubProgress';
import { useExportNotes } from '../features/reader/hooks/useExportNotes';
import { useReaderStore } from '../stores';

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
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

import { apiRequest } from '../lib/api';
import { saveProgress, queueSync } from '../lib/offline';

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
    const markPageRead = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
      markPageRead,
    );

    expect(typeof handler).toBe('function');
  });

  it('saves progress when online', async () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const markPageRead = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
      markPageRead,
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
    const markPageRead = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
      markPageRead,
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
    const markPageRead = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }],
      currentChapterRef,
      onChapterChange,
      markPageRead,
    );

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    await handler({ start: { cfi: 'epubcfi(/6/4)', progress: 50, href: 'ch1.xhtml' } });

    expect(saveProgress).toHaveBeenCalled();
  });

  it('updates chapter when toc item found', async () => {
    const setProgress = vi.fn();
    const setCurrentChapter = vi.fn();
    const onChapterChange = vi.fn();
    const markPageRead = vi.fn();
    const currentChapterRef = { current: null };

    const handler = createRelocatedHandler(
      'book-1',
      'token-123',
      setProgress,
      setCurrentChapter,
      [{ href: 'ch1.xhtml' }, { href: 'ch2.xhtml' }],
      currentChapterRef,
      onChapterChange,
      markPageRead,
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
    const anchorProps = { click: mockClick, href: '', download: '' };
    vi.spyOn(document, 'createElement').mockReturnValue(anchorProps as unknown as HTMLAnchorElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    result.current.handleExportNotes('My Book');

    expect(mockClick).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
