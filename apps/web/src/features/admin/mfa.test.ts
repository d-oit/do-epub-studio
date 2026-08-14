import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performPasskeyEnroll, performPasskeyAuth, isMfaRequired } from './mfa';
import * as browser from '@simplewebauthn/browser';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('../../lib/api', () => ({ apiRequest: mockRequest }));

const mockRefreshSession = vi.fn();
vi.mock('../../stores/auth', () => ({
  useAuthStore: {
    getState: () => ({ sessionToken: 'old-token', refreshSession: mockRefreshSession }),
  },
}));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

describe('useAdminMfa (admin passkey + recovery codes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSession.mockClear();
  });

  it('performPasskeyEnroll runs the ceremony and refreshes the session with the rotated token', async () => {
    const options = { challenge: 'chal', rp: { id: 'localhost', name: 'd.o.EPUB Studio' } };
    const registrationResponse = { id: 'cred-1', response: { clientDataJSON: 'xx' } };

    mockRequest
      .mockResolvedValueOnce({ options }) // register-start
      .mockResolvedValueOnce({ token: 'rotated', recoveryCodes: ['c1', 'c2'], deviceId: 'cred-1' }); // register-verify
    vi.mocked(browser.startRegistration).mockResolvedValue(registrationResponse as never);

    const result = await performPasskeyEnroll('mypassword', 'Laptop');

    expect(mockRequest).toHaveBeenCalledWith('/api/admin/account/mfa/register-start', {
      method: 'POST',
      token: 'old-token',
      body: JSON.stringify({ currentPassword: 'mypassword', displayName: 'Laptop' }),
    });
    expect(browser.startRegistration).toHaveBeenCalledWith({ optionsJSON: options });
    expect(mockRequest).toHaveBeenCalledWith('/api/admin/account/mfa/register-verify', {
      method: 'POST',
      token: 'old-token',
      body: JSON.stringify({ registrationResponse, deviceName: 'Laptop' }),
    });
    // Rotated token stored so guarded mutations use it next.
    expect(mockRefreshSession).toHaveBeenCalledWith({ sessionToken: 'rotated' });
    expect(result.token).toBe('rotated');
    expect(result.recoveryCodes).toEqual(['c1', 'c2']);
  });

  it('performPasskeyAuth refreshes the session with the mfa-raised token', async () => {
    const options = { challenge: 'chal2' };
    const authResponse = { id: 'cred-1', response: { clientDataJSON: 'yy' } };

    mockRequest
      .mockResolvedValueOnce({ options }) // authenticate-start
      .mockResolvedValueOnce({ token: 'mfa-token' }); // authenticate-verify
    vi.mocked(browser.startAuthentication).mockResolvedValue(authResponse as never);

    const token = await performPasskeyAuth();

    expect(mockRefreshSession).toHaveBeenCalledWith({ sessionToken: 'mfa-token' });
    expect(token).toBe('mfa-token');
  });

  it('propagates enrollment failures (does not refresh on error)', async () => {
    mockRequest.mockRejectedValue(new Error('start failed'));

    await expect(performPasskeyEnroll('pw', 'Laptop')).rejects.toThrow('start failed');
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('isMfaRequired detects the 428 MFA_REQUIRED worker code', () => {
    expect(isMfaRequired({ code: 'MFA_REQUIRED', status: 428 })).toBe(true);
    expect(isMfaRequired({ code: 'STEP_UP_REQUIRED', status: 428 })).toBe(false);
    expect(isMfaRequired(new Error('nope'))).toBe(false);
  });
});
