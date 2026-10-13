import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const clearAllEncryptedData = vi.fn<() => Promise<void>>();
const logClientEvent = vi.fn();
const apiRequest = vi.fn<() => Promise<unknown>>();

vi.mock('../lib/offline/db', () => ({
  clearAllEncryptedData: () => clearAllEncryptedData(),
}));
vi.mock('../lib/client-logger', () => ({
  logClientEvent: (entry: unknown) => logClientEvent(entry),
}));
vi.mock('../lib/api', () => ({
  apiRequest: () => apiRequest(),
}));

import { useReaderLogout } from '../features/reader/hooks/useReaderLogout';
import { useAuthStore } from '../stores/auth';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('S1: useReaderLogout device-data teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiRequest.mockResolvedValue({});
    useAuthStore.setState({ sessionToken: 'tok', isAuthenticated: true });
  });

  it('reports a purge failure as reader.logout_cleanup_failed and still signs out', async () => {
    clearAllEncryptedData.mockRejectedValue(new Error('IDB blocked'));

    const { result } = renderHook(() => useReaderLogout(), { wrapper });
    await act(async () => {
      await result.current();
    });

    expect(logClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        event: 'reader.logout_cleanup_failed',
        error: expect.objectContaining({ message: 'IDB blocked' }),
      }),
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().sessionToken).toBeNull();
  });

  it('does not report cleanup failure when the purge succeeds', async () => {
    clearAllEncryptedData.mockResolvedValue(undefined);

    const { result } = renderHook(() => useReaderLogout(), { wrapper });
    await act(async () => {
      await result.current();
    });

    expect(logClientEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'reader.logout_cleanup_failed' }),
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
