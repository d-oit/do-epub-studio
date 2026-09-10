import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSyncStatus } from '../useSyncStatus';
import { useAuthStore } from '../../stores/auth';
import { useReaderStore } from '../../stores/reader';
import { getSyncQueue, setupOnlineListener } from '../../lib/offline';
import type { SyncQueueItem } from '../../lib/offline/db';

vi.mock('../../lib/offline', () => ({
  getSyncQueue: vi.fn(),
  setupOnlineListener: vi.fn(() => vi.fn()),
}));

const getSyncQueueMock = vi.mocked(getSyncQueue);
const setupOnlineListenerMock = vi.mocked(setupOnlineListener);

describe('useSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSyncQueueMock.mockResolvedValue([]);
    setupOnlineListenerMock.mockImplementation(() => vi.fn());
    useAuthStore.setState({ isAuthenticated: false });
    useReaderStore.setState({ isOffline: false, pendingSyncCount: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets the count and skips queue reads when logged out', () => {
    useReaderStore.setState({ pendingSyncCount: 5 });

    renderHook(() => useSyncStatus());

    expect(useReaderStore.getState().pendingSyncCount).toBe(0);
    expect(getSyncQueueMock).not.toHaveBeenCalled();
    expect(setupOnlineListenerMock).not.toHaveBeenCalled();
  });

  it('polls the queue and stores the pending count when authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    const queue: SyncQueueItem[] = [
      { id: 'a', type: 'progress', payload: {}, mutationId: 'm-a', createdAt: 0, attempts: 0 },
      { id: 'b', type: 'annotation', payload: {}, mutationId: 'm-b', createdAt: 0, attempts: 0 },
    ];
    getSyncQueueMock.mockResolvedValue(queue);

    renderHook(() => useSyncStatus());

    await waitFor(() => expect(useReaderStore.getState().pendingSyncCount).toBe(2));
    expect(setupOnlineListenerMock).toHaveBeenCalledTimes(1);
  });

  it('mirrors connectivity events into reader state', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    renderHook(() => useSyncStatus());
    await waitFor(() => expect(getSyncQueueMock).toHaveBeenCalled());

    window.dispatchEvent(new Event('offline'));
    expect(useReaderStore.getState().isOffline).toBe(true);

    window.dispatchEvent(new Event('online'));
    expect(useReaderStore.getState().isOffline).toBe(false);
  });

  it('stops polling and removes listeners on unmount', async () => {
    vi.useFakeTimers();
    useAuthStore.setState({ isAuthenticated: true });

    const { unmount } = renderHook(() => useSyncStatus());
    await vi.advanceTimersByTimeAsync(0);
    const callsBefore = getSyncQueueMock.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    unmount();
    await vi.advanceTimersByTimeAsync(15000);
    expect(getSyncQueueMock.mock.calls.length).toBe(callsBefore);

    window.dispatchEvent(new Event('offline'));
    expect(useReaderStore.getState().isOffline).toBe(false);
  });
});
