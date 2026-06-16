import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionExpiry } from '../hooks/useSessionExpiry';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

import { apiRequest } from '../lib/api';
import { logClientEvent } from '../lib/client-logger';

describe('useSessionExpiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useAuthStore.setState({
      sessionToken: 'token-123',
      sessionExpiresAt: Date.now() + 600000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns active state when session is valid', () => {
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.state).toBe('active');
    expect(result.current.expiresAt).toBeTypeOf('number');
  });

  it('returns idle state when no expiresAt', () => {
    useAuthStore.setState({ sessionExpiresAt: null });
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.state).toBe('idle');
  });

  it('returns null msUntilExpiry when no expiresAt', () => {
    useAuthStore.setState({ sessionExpiresAt: null });
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.msUntilExpiry).toBeNull();
  });

  it('returns positive msUntilExpiry', () => {
    useAuthStore.setState({ sessionExpiresAt: Date.now() + 600000 });
    const { result } = renderHook(() => useSessionExpiry());
    expect(result.current.msUntilExpiry).toBeGreaterThan(0);
  });

  it('manually refreshes session', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      sessionToken: 'new-token',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    expect(apiRequest).toHaveBeenCalled();
  });

  it('handles refresh failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSessionExpiry());

    await act(async () => {
      await result.current.refresh();
    });

    expect(logClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session-refresh-failed-manual' }),
    );
  });
});
