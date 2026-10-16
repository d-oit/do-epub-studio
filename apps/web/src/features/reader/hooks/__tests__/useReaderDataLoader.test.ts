import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReaderStore } from '../../../../stores';

const mocks = vi.hoisted(() => ({
  fetchHighlights: vi.fn(),
  fetchComments: vi.fn(),
  fetchProgress: vi.fn(),
  apiRequest: vi.fn(),
  getProgress: vi.fn(),
  getAnnotations: vi.fn(),
  subscribeAnnotationChanges: vi.fn(() => () => undefined),
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

vi.mock('../../../../lib/api/index', () => ({
  apiRequest: mocks.apiRequest,
  fetchHighlights: mocks.fetchHighlights,
  fetchComments: mocks.fetchComments,
  fetchProgress: mocks.fetchProgress,
}));

vi.mock('../../../../lib/offline', () => ({
  getProgress: mocks.getProgress,
  getAnnotations: mocks.getAnnotations,
  subscribeAnnotationChanges: mocks.subscribeAnnotationChanges,
}));

vi.mock('../../../../lib/client-logger', () => ({
  logClientEvent: mocks.logClientEvent,
  createPerformanceMark: mocks.createPerformanceMark,
  measurePerformance: mocks.measurePerformance,
}));

import { useReaderDataLoader } from '../useReaderDataLoader';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

function renderLoader(bookId = 'book-1') {
  const setters = {
    setHighlights: vi.fn(),
    setComments: vi.fn(),
    setBookmarks: vi.fn(),
  };
  const view = renderHook(() =>
    useReaderDataLoader({
      sessionToken: 'token-123',
      bookId,
      setProgress: (progress) => useReaderStore.getState().setProgress(progress),
      ...setters,
    }),
  );
  return { view, ...setters };
}

describe('useReaderDataLoader — progress restore gating', () => {
  beforeEach(() => {
    mocks.getProgress.mockReset().mockResolvedValue(undefined);
    mocks.getAnnotations.mockReset().mockResolvedValue([]);
    mocks.fetchProgress.mockReset();
    mocks.fetchHighlights.mockReset().mockResolvedValue([]);
    mocks.fetchComments.mockReset().mockResolvedValue([]);
    mocks.apiRequest.mockReset().mockResolvedValue([]);
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
      progressRestored: false,
    });
  });

  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it('re-enables persistence after an offline load, not only after the online path', async () => {
    setOnline(false);
    mocks.getProgress.mockResolvedValue({
      id: 'book-1-progress',
      bookId: 'book-1',
      cfi: 'epubcfi(/6/10[chap2]!/4/2/4)',
      percentage: 75,
      lastRead: Date.now(),
      synced: false,
      mutationId: 'offline-mut-progress-75',
    });

    renderLoader();

    await waitFor(() => {
      expect(useReaderStore.getState().progress.progressPercent).toBe(75);
    });
    // The offline branch returns before the online branch's `finally`; without
    // its own completion call the relocation handler stays gated and every
    // page turn read offline would be dropped instead of persisted.
    expect(useReaderStore.getState().progressRestored).toBe(true);
    expect(mocks.fetchProgress).not.toHaveBeenCalled();
  });

  it('re-enables persistence when an offline read rejects', async () => {
    setOnline(false);
    mocks.getProgress.mockRejectedValue(new Error('IndexedDB unavailable'));
    mocks.getAnnotations.mockRejectedValue(new Error('IndexedDB unavailable'));

    renderLoader();

    await waitFor(() => {
      expect(useReaderStore.getState().progressRestored).toBe(true);
    });
  });

  it('re-enables persistence after the online load', async () => {
    setOnline(true);
    mocks.fetchProgress.mockResolvedValue({
      locator: { cfi: 'epubcfi(/6/4[chap1]!/4/2/2)' },
      progressPercent: 10,
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision: 1,
    });

    renderLoader();

    await waitFor(() => {
      expect(useReaderStore.getState().progress.progressPercent).toBe(10);
    });
    expect(useReaderStore.getState().progressRestored).toBe(true);
    expect(mocks.getProgress).toHaveBeenCalled();
  });

  it('keeps persistence gated while the load is still in flight', async () => {
    setOnline(false);
    let resolveProgress: (value: unknown) => void = () => undefined;
    mocks.getProgress.mockReturnValue(
      new Promise((resolve) => {
        resolveProgress = resolve;
      }),
    );

    const { view } = renderLoader();
    expect(useReaderStore.getState().progressRestored).toBe(false);

    act(() => {
      resolveProgress(null);
    });
    await waitFor(() => {
      expect(useReaderStore.getState().progressRestored).toBe(true);
    });
    view.unmount();
  });
});
