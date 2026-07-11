import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../stores/auth';
import { useSessionExpiry } from './useSessionExpiry';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

import { apiRequest } from '../lib/api';
import { logClientEvent } from '../lib/client-logger';

const mockApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;
const mockLogClientEvent = logClientEvent as unknown as ReturnType<typeof vi.fn>;

describe('useSessionExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useAuthStore.setState({
      sessionToken: null,
      sessionExpiresAt: null,
      isAuthenticated: false,
    });
    mockApiRequest.mockReset();
    mockLogClientEvent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns idle when not authenticated', () => {
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.state).toBe('idle');
    expect(result.current.expiresAt).toBeNull();
    expect(result.current.msUntilExpiry).toBeNull();
  });

  it('reports active when expiry is well in the future', () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.state).toBe('active');
    expect(result.current.msUntilExpiry).toBeGreaterThan(0);
  });

  it('does not call the refresh endpoint when no session is present', () => {
    renderHook(() => useSessionExpiry());
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('manual refresh updates the store with a new token', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 'old',
        sessionExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'fresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const { result } = renderHook(() => useSessionExpiry());
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('fresh');
    expect(state.sessionExpiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('clears the session on forced logout when expired', () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 'stale',
        sessionExpiresAt: Date.now() - 60_000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockRejectedValue(new Error('SESSION_INVALID'));
    renderHook(() => useSessionExpiry());
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('enters expiring state when within 5-minute window', () => {
    const future = Date.now() + 3 * 60 * 1000;
    act(() => {
      useAuthStore.setState({
        sessionToken: null,
        sessionExpiresAt: future,
        isAuthenticated: true,
      });
    });
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.state).toBe('expiring');
  });

  it('logs expiring telemetry once', () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 3 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    renderHook(() => useSessionExpiry());
    expect(mockLogClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-expiring' }),
    );
  });

  it('auto-refreshes when expiring and logs success', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 3 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'new-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    renderHook(() => useSessionExpiry());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/access/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockLogClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-refreshed' }),
    );
  });

  it('handles auto-refresh failure and logs warning', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 3 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockRejectedValue(new Error('Network error'));
    renderHook(() => useSessionExpiry());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockLogClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-refresh-failed' }),
    );
  });

  it('auto-refresh failure triggers retry timeout callback', async () => {
    const future = Date.now() + 3 * 60 * 1000;
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: future,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockRejectedValue(new Error('fail'));
    renderHook(() => useSessionExpiry());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);

    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('t');
  });

  it('manual refresh handles failure gracefully', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockLogClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-refresh-failed-manual' }),
    );
  });

  it('manual refresh does nothing without session token', async () => {
    useAuthStore.setState({ sessionToken: null });
    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('logs expired event and calls logout when expired', () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() - 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockRejectedValue(new Error('fail'));
    renderHook(() => useSessionExpiry());

    expect(mockLogClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-expired' }),
    );
  });

  it('resets flags when expiresAt changes after refresh', async () => {
    const futureExpiry = Date.now() + 6 * 24 * 60 * 60 * 1000;
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: futureExpiry,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'new',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    const newExpiry = useAuthStore.getState().sessionExpiresAt;
    expect(newExpiry).toBeGreaterThan(futureExpiry);
  });

  it('auto-refresh updates store with new token and expiry', async () => {
    const future = Date.now() + 3 * 60 * 1000;
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: future,
        isAuthenticated: true,
      });
    });
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockApiRequest.mockResolvedValue({
      sessionToken: 'refreshed',
      expiresAt: newExpiry.toISOString(),
    });
    renderHook(() => useSessionExpiry());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('refreshed');
    expect(state.sessionExpiresAt).toBe(newExpiry.getTime());
  });

  it('auto-refresh handles response without expiresAt', async () => {
    const future = Date.now() + 3 * 60 * 1000;
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: future,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'token-only',
    });
    renderHook(() => useSessionExpiry());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('token-only');
    expect(state.sessionExpiresAt).toBeNull();
  });

  it('manual refresh handles response without expiresAt', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'token-only',
    });
    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('token-only');
    expect(state.sessionExpiresAt).toBeNull();
  });

  it('returns manual refresh via callback', async () => {
    act(() => {
      useAuthStore.setState({
        sessionToken: 't',
        sessionExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      });
    });
    mockApiRequest.mockResolvedValue({
      sessionToken: 'refreshed',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const { result } = renderHook(() => useSessionExpiry());

    expect(typeof result.current.refresh).toBe('function');

    await act(async () => {
      await result.current.refresh();
    });

    expect(useAuthStore.getState().sessionToken).toBe('refreshed');
  });
});
