import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore, useReaderStore } from '../../stores';
import { fetchProgress } from '../../lib/api/index';
import { logClientEvent } from '../../lib/client-logger';
import { getProgress } from '../../lib/offline';

// Mock dependencies
vi.mock('../../lib/api/index', () => ({
  apiRequest: vi.fn((url: string) =>
    Promise.resolve(url.includes('bookmarks') ? [] : { url: 'mock-url' }),
  ),
  fetchProgress: vi.fn(),
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/api/index/annotations', () => ({
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('../../lib/offline', () => ({
  setupOnlineListener: vi.fn(() => () => {}),
  getSyncQueue: vi.fn(() => Promise.resolve([])),
  getProgress: vi.fn(),
}));

// Mock epub-js and hooks
vi.mock('@intity/epub-js', () => ({
  default: vi.fn(() => ({
    ready: Promise.resolve(),
    loaded: { navigation: Promise.resolve({ toc: [] }), metadata: Promise.resolve(new Map()) },
    renderTo: vi.fn(() => ({
      display: vi.fn(),
      on: vi.fn(),
      hooks: { content: { register: vi.fn() } },
      themes: { registerRules: vi.fn(), select: vi.fn() },
      destroy: vi.fn(),
    })),
    destroy: vi.fn(),
  })),
}));

describe('ReaderPage Progress Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      sessionToken: 'test-token',
      bookId: 'test-book-id',
      bookSlug: 'test-book',
      isAuthenticated: true,
      capabilities: { canRead: true, canComment: true, canHighlight: true } as any,
    });
    useReaderStore.setState({
      highlights: [],
      comments: [],
      bookmarks: [],
      error: null,
      isLoading: false,
      progress: { locator: null, progressPercent: 0, updatedAt: null },
    });
  });

  it('loads progress from server on initial load', async () => {
    const mockProgress = {
      locator: { cfi: 'epubcfi(/6/4[chap1]!/4/2/2)' },
      progressPercent: 0.5,
      updatedAt: '2024-01-01T00:00:00Z',
    };
    vi.mocked(fetchProgress).mockResolvedValue(mockProgress);

    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <ReaderPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useReaderStore.getState().progress).toEqual(mockProgress);
    });

    expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'reader.progress_loaded',
      metadata: expect.objectContaining({ source: 'server' }),
    }));
  });

  it('falls back to offline progress if server fetch fails', async () => {
    vi.mocked(fetchProgress).mockRejectedValue(new Error('Network error'));
    const mockOfflineProgress = {
      cfi: 'epubcfi(/6/4[chap1]!/4/2/2)',
      percentage: 0.5,
      lastRead: Date.now(),
    };
    vi.mocked(getProgress).mockResolvedValue(mockOfflineProgress as any);

    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <ReaderPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useReaderStore.getState().progress.locator?.cfi).toBe(mockOfflineProgress.cfi);
    });

    expect(logClientEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: 'reader.progress_loaded',
      metadata: expect.objectContaining({ source: 'offline' }),
    }));
  });
});
