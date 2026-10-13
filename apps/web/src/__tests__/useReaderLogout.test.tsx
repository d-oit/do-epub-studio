import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

// Renders the logout hook alongside a location probe so the test can assert
// the redirect target the user actually lands on. The probe reports through a
// callback; it never mutates its props.
function renderLogout() {
  let location = '';
  const onLocation = (value: string) => {
    location = value;
  };
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/read/book-1']}>
        {children}
        <LocationProbe onLocation={onLocation} />
      </MemoryRouter>
    );
  }
  const hook = renderHook(() => useReaderLogout(), { wrapper });
  return { ...hook, currentLocation: () => location };
}

function LocationProbe({ onLocation }: { onLocation: (value: string) => void }) {
  const loc = useLocation();
  onLocation(`${loc.pathname}${loc.search}`);
  return null;
}

describe('S1: useReaderLogout device-data teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiRequest.mockResolvedValue({});
    useAuthStore.setState({ sessionToken: 'tok', isAuthenticated: true });
  });

  it('reports a purge failure as reader.logout_cleanup_failed and still signs out', async () => {
    clearAllEncryptedData.mockRejectedValue(new Error('IDB blocked'));

    const { result } = renderLogout();
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

  it('redirects to /login?cleanup=failed when the device purge fails', async () => {
    clearAllEncryptedData.mockRejectedValue(new Error('IDB blocked'));

    const { result, currentLocation } = renderLogout();
    await act(async () => {
      await result.current();
    });

    expect(currentLocation()).toBe('/login?cleanup=failed');
  });

  it('redirects to plain /login when the purge succeeds', async () => {
    clearAllEncryptedData.mockResolvedValue(undefined);

    const { result, currentLocation } = renderLogout();
    await act(async () => {
      await result.current();
    });

    expect(currentLocation()).toBe('/login');
    expect(logClientEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'reader.logout_cleanup_failed' }),
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
