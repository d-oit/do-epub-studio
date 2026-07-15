import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReaderDataLoader } from './useReaderDataLoader';
import type { Highlight, Comment, Bookmark, ReadingProgress } from '../../../stores';
import type { ProgressEntry, AnnotationEntry } from '../../../lib/offline';

vi.mock('../../../lib/api/index', () => ({
  apiRequest: vi.fn(),
  fetchHighlights: vi.fn(),
  fetchComments: vi.fn(),
  fetchProgress: vi.fn(),
}));

vi.mock('../../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('../../../lib/offline', () => ({
  getProgress: vi.fn(),
  getAnnotations: vi.fn(),
}));

import { apiRequest, fetchHighlights, fetchComments, fetchProgress } from '../../../lib/api/index';
import { logClientEvent } from '../../../lib/client-logger';
import { getProgress, getAnnotations } from '../../../lib/offline';

const mockHighlights: Highlight[] = [{ id: 'h1', chapterRef: 'ch1', cfiRange: 'cfi1', selectedText: 'text', note: null, color: 'yellow', createdAt: '2024-01-01', updatedAt: '2024-01-01' }];
const mockComments: Comment[] = [{ id: 'c1', userEmail: '', chapterRef: 'ch1', cfiRange: 'cfi1', selectedText: null, body: 'body', status: 'open', visibility: 'shared', parentCommentId: null, createdAt: '2024-01-01', updatedAt: '2024-01-01', resolvedAt: null }];
const mockBookmarks: Bookmark[] = [{ id: 'b1', locator: { cfi: 'cfi1' }, label: 'mark', createdAt: '2024-01-01' }];
const mockProgress: ReadingProgress = { locator: { cfi: 'cfi1' }, progressPercent: 0.5, updatedAt: '2024-01-01' };

function createMockSetters() {
  return {
    setHighlights: vi.fn(),
    setComments: vi.fn(),
    setBookmarks: vi.fn(),
    setProgress: vi.fn(),
  };
}

describe('useReaderDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when sessionToken is null', () => {
    const setters = createMockSetters();
    renderHook(() => { useReaderDataLoader({ sessionToken: null, bookId: 'book1', ...setters }); });
    expect(fetchHighlights).not.toHaveBeenCalled();
    expect(logClientEvent).not.toHaveBeenCalled();
  });

  it('does nothing when bookId is null', () => {
    const setters = createMockSetters();
    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: null, ...setters }); });
    expect(fetchHighlights).not.toHaveBeenCalled();
    expect(logClientEvent).not.toHaveBeenCalled();
  });

  it('fetches from server and sets all data on success', async () => {
    vi.mocked(fetchHighlights).mockResolvedValue(mockHighlights);
    vi.mocked(fetchComments).mockResolvedValue(mockComments);
    vi.mocked(apiRequest).mockResolvedValue(mockBookmarks);
    vi.mocked(fetchProgress).mockResolvedValue(mockProgress);
    const setters = createMockSetters();

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(setters.setHighlights).toHaveBeenCalledWith(mockHighlights);
    });
    expect(setters.setComments).toHaveBeenCalledWith(mockComments);
    expect(setters.setBookmarks).toHaveBeenCalledWith(mockBookmarks);
    expect(setters.setProgress).toHaveBeenCalledWith(mockProgress);
    expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'reader.progress_loaded',
      metadata: expect.objectContaining({ source: 'server' }),
    }));
  });

  it('falls back to offline progress when server fetch fails', async () => {
    vi.mocked(fetchHighlights).mockRejectedValue(new Error('Network'));
    vi.mocked(fetchComments).mockRejectedValue(new Error('Network'));
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network'));
    vi.mocked(fetchProgress).mockRejectedValue(new Error('Network'));
    vi.mocked(getProgress).mockResolvedValue({ cfi: 'offline-cfi', percentage: 0.3, lastRead: 1700000000000 } as ProgressEntry);
    vi.mocked(getAnnotations).mockResolvedValue([]);
    const setters = createMockSetters();

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(setters.setProgress).toHaveBeenCalledWith(expect.objectContaining({
        locator: { cfi: 'offline-cfi' },
        progressPercent: 0.3,
      }));
    });
    expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'reader.progress_loaded',
      metadata: expect.objectContaining({ source: 'offline' }),
    }));
  });

  it('restores offline annotations when server fetch fails', async () => {
    vi.mocked(fetchHighlights).mockRejectedValue(new Error('fail'));
    vi.mocked(fetchComments).mockRejectedValue(new Error('fail'));
    vi.mocked(apiRequest).mockRejectedValue(new Error('fail'));
    vi.mocked(fetchProgress).mockRejectedValue(new Error('fail'));
    vi.mocked(getProgress).mockResolvedValue(undefined);
    vi.mocked(getAnnotations).mockResolvedValue([
      { id: 'h1', bookId: 'book1', type: 'highlight', cfi: 'cfi', text: 'txt', createdAt: 1700000000000, synced: true, mutationId: 'm1' },
      { id: 'c1', bookId: 'book1', type: 'comment', cfi: 'cfi', comment: 'body', createdAt: 1700000000000, synced: true, mutationId: 'm2' },
      { id: 'b1', bookId: 'book1', type: 'bookmark', cfi: 'cfi', text: 'label', createdAt: 1700000000000, synced: true, mutationId: 'm3' },
    ] as AnnotationEntry[]);
    const setters = createMockSetters();

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(setters.setHighlights).toHaveBeenCalledWith([expect.objectContaining({ id: 'h1', cfiRange: 'cfi' })]);
    });
    expect(setters.setComments).toHaveBeenCalledWith([expect.objectContaining({ id: 'c1', body: 'body' })]);
    expect(setters.setBookmarks).toHaveBeenCalledWith([expect.objectContaining({ id: 'b1', label: 'label' })]);
    expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'reader.offline_annotations_restored',
      metadata: expect.objectContaining({ highlights: 1, comments: 1, bookmarks: 1 }),
    }));
  });

  it('logs reader.offline_cache_error at debug level when offline processing throws', async () => {
    vi.mocked(fetchHighlights).mockRejectedValue(new Error('server'));
    vi.mocked(fetchComments).mockRejectedValue(new Error('server'));
    vi.mocked(apiRequest).mockRejectedValue(new Error('server'));
    vi.mocked(fetchProgress).mockRejectedValue(new Error('server'));
    // getProgress returns valid data but setProgress throws during offline processing
    vi.mocked(getProgress).mockResolvedValue({ cfi: 'cached', percentage: 0.5, lastRead: 1700000000000 } as ProgressEntry);
    vi.mocked(getAnnotations).mockResolvedValue([]);
    const setters = createMockSetters();
    setters.setProgress.mockImplementation(() => { throw new Error('store error'); });

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
        level: 'debug',
        event: 'reader.offline_cache_error',
      }));
    });
  });

  it('handles mixed allSettled results (progress ok, annotations fail)', async () => {
    vi.mocked(fetchHighlights).mockRejectedValue(new Error('server'));
    vi.mocked(fetchComments).mockRejectedValue(new Error('server'));
    vi.mocked(apiRequest).mockRejectedValue(new Error('server'));
    vi.mocked(fetchProgress).mockRejectedValue(new Error('server'));
    vi.mocked(getProgress).mockResolvedValue({ cfi: 'cached', percentage: 0.8, lastRead: 1700000000000 } as ProgressEntry);
    vi.mocked(getAnnotations).mockRejectedValue(new Error('IDB corrupt'));
    const setters = createMockSetters();

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(setters.setProgress).toHaveBeenCalledWith(expect.objectContaining({
        locator: { cfi: 'cached' },
        progressPercent: 0.8,
      }));
    });
    expect(setters.setHighlights).not.toHaveBeenCalled();
    expect(setters.setComments).not.toHaveBeenCalled();
    expect(setters.setBookmarks).not.toHaveBeenCalled();
  });

  it('logs reader.load_failed on server fetch error', async () => {
    vi.mocked(fetchHighlights).mockRejectedValue(new Error('timeout'));
    vi.mocked(fetchComments).mockRejectedValue(new Error('timeout'));
    vi.mocked(apiRequest).mockRejectedValue(new Error('timeout'));
    vi.mocked(fetchProgress).mockRejectedValue(new Error('timeout'));
    vi.mocked(getProgress).mockResolvedValue(undefined);
    vi.mocked(getAnnotations).mockResolvedValue([]);
    const setters = createMockSetters();

    renderHook(() => { useReaderDataLoader({ sessionToken: 'token', bookId: 'book1', ...setters }); });

    await waitFor(() => {
      expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn',
        event: 'reader.load_failed',
        error: expect.objectContaining({ name: 'Error', message: 'timeout' }),
      }));
    });
  });
});
