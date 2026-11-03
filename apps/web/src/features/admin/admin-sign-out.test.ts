import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest, logout, state } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  logout: vi.fn(),
  state: { sessionToken: 'admin-token' as string | null } satisfies {
    sessionToken: string | null;
  },
}));

vi.mock('../../lib/api', () => ({ apiRequest }));
vi.mock('../../lib/client-logger', () => ({ logClientEvent: vi.fn() }));
vi.mock('../../stores/auth', () => ({
  useAuthStore: { getState: () => ({ ...state, logout }) },
}));

import { signOutAdmin } from './admin-sign-out';

describe('signOutAdmin', () => {
  beforeEach(() => {
    apiRequest.mockReset().mockResolvedValue({ ok: true });
    logout.mockReset();
    state.sessionToken = 'admin-token';
  });

  it('revokes the current session and clears local auth', async () => {
    await signOutAdmin();

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/logout', {
      method: 'POST',
      token: 'admin-token',
    });
    expect(logout).toHaveBeenCalledWith('manual');
  });

  it('still clears local auth when revocation fails', async () => {
    apiRequest.mockRejectedValue(new Error('network down'));

    await signOutAdmin();

    expect(logout).toHaveBeenCalledWith('manual');
  });
});
