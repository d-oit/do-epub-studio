/* eslint-disable @typescript-eslint/no-explicit-any -- test file with broad json body casts */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockRequireAdminAuth,
  mockHashAdminToken,
  mockVerifyAccountPassword,
  mockRaiseAdminAssurance,
  mockRevokeAllAdminSessionsForUser,
  mockLogAudit,
  mockCreateAdminSessionMfa,
} from './fixtures';
import { app } from '../app';

// ---------------------------------------------------------------------------
// Mock the SimpleWebAuthn server + the auth/mfa helpers so the route handlers
// are driven without real WebAuthn attestation or DB writes.
// ---------------------------------------------------------------------------

const {
  mockGenerateRegistrationOptions,
  mockVerifyRegistrationResponse,
  mockGenerateAuthenticationOptions,
  mockVerifyAuthenticationResponse,
  mockStoreChallenge,
  mockFindChallenge,
  mockConsumeChallenge,
  mockIsChallengeUsable,
  mockDecodeClientDataChallenge,
  mockCreateRecoveryCodes,
  mockWriteRecoveryHashes,
  mockHasRecoveryCodes,
  mockClearRecoveryHashes,
  mockClearMfaEnrolled,
  mockSetMfaEnrolled,
  mockGetMfaState,
  mockListPasskeys,
  mockGetPasskeyById,
  mockGetPasskeyByCredentialId,
  mockInsertPasskey,
  mockUpdatePasskeyCounter,
  mockDeletePasskey,
  mockUserHasMfa,
  mockVerifyRecoveryCode,
  mockCreateLoginTicket,
  mockFindLoginTicket,
  mockConsumeLoginTicket,
} = vi.hoisted(() => ({
  mockGenerateRegistrationOptions: vi.fn(),
  mockVerifyRegistrationResponse: vi.fn(),
  mockGenerateAuthenticationOptions: vi.fn(),
  mockVerifyAuthenticationResponse: vi.fn(),
  mockStoreChallenge: vi.fn(),
  mockFindChallenge: vi.fn(),
  mockConsumeChallenge: vi.fn(),
  mockIsChallengeUsable: vi.fn(),
  mockDecodeClientDataChallenge: vi.fn(),
  mockCreateRecoveryCodes: vi.fn(),
  mockWriteRecoveryHashes: vi.fn(),
  mockHasRecoveryCodes: vi.fn(),
  mockClearRecoveryHashes: vi.fn(),
  mockClearMfaEnrolled: vi.fn(),
  mockSetMfaEnrolled: vi.fn(),
  mockGetMfaState: vi.fn(),
  mockListPasskeys: vi.fn(),
  mockGetPasskeyById: vi.fn(),
  mockGetPasskeyByCredentialId: vi.fn(),
  mockInsertPasskey: vi.fn(),
  mockUpdatePasskeyCounter: vi.fn(),
  mockDeletePasskey: vi.fn(),
  mockUserHasMfa: vi.fn(),
  mockVerifyRecoveryCode: vi.fn(),
  mockCreateLoginTicket: vi.fn(),
  mockFindLoginTicket: vi.fn(),
  mockConsumeLoginTicket: vi.fn(),
}));

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: mockGenerateRegistrationOptions,
  verifyRegistrationResponse: mockVerifyRegistrationResponse,
  generateAuthenticationOptions: mockGenerateAuthenticationOptions,
  verifyAuthenticationResponse: mockVerifyAuthenticationResponse,
}));

vi.mock('../auth/mfa', () => ({
  storeChallenge: mockStoreChallenge,
  findChallenge: mockFindChallenge,
  consumeChallenge: mockConsumeChallenge,
  isChallengeUsable: mockIsChallengeUsable,
  userHasMfa: mockUserHasMfa,
  verifyRecoveryCode: mockVerifyRecoveryCode,
  decodeClientDataChallenge: mockDecodeClientDataChallenge,
  createRecoveryCodes: mockCreateRecoveryCodes,
  writeRecoveryHashes: mockWriteRecoveryHashes,
  hasRecoveryCodes: mockHasRecoveryCodes,
  clearRecoveryHashes: mockClearRecoveryHashes,
  clearMfaEnrolled: mockClearMfaEnrolled,
  setMfaEnrolled: mockSetMfaEnrolled,
  getMfaState: mockGetMfaState,
  listPasskeys: mockListPasskeys,
  getPasskeyById: mockGetPasskeyById,
  getPasskeyByCredentialId: mockGetPasskeyByCredentialId,
  insertPasskey: mockInsertPasskey,
  updatePasskeyCounter: mockUpdatePasskeyCounter,
  deletePasskey: mockDeletePasskey,
  createLoginTicket: mockCreateLoginTicket,
  findLoginTicket: mockFindLoginTicket,
  consumeLoginTicket: mockConsumeLoginTicket,
  isLoginTicketUsable: (t: { expires_at: string; used_at: string | null } | null) => Boolean(t && !t?.used_at),
  bufferToBase64Url: (bytes: { length: number }) => `pk-${bytes.length}`,
  decodeBase64UrlToBytes: () => new Uint8Array(8),
}));

describe('Admin MFA (ADR-234 items 5+6)', () => {
  const env = makeEnv();
  const BASE = 'http://localhost/api/admin/account/mfa';

  const mockAdminAuth = () =>
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

  const mockSessionAssurance = (assurance: string | null) => {
    mockHashAdminToken.mockResolvedValue('hash-of-token');
    mockQueryFirst.mockResolvedValue(assurance === null ? null : { assurance_level: assurance });
  };

  const usableChallenge = {
    user_id: 'admin-1',
    purpose: 'registration' as const,
    raw_challenge: 'chal-1',
    expires_at: '2099-01-01T00:00:00.000Z',
    used_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
    mockVerifyAccountPassword.mockResolvedValue(true);
    mockRaiseAdminAssurance.mockResolvedValue({ ok: true, token: 'rotated-token' });
    mockHashAdminToken.mockResolvedValue('hash');
    mockRevokeAllAdminSessionsForUser.mockResolvedValue(undefined);
    mockStoreChallenge.mockResolvedValue(undefined);
    mockWriteRecoveryHashes.mockResolvedValue(undefined);
    mockSetMfaEnrolled.mockResolvedValue(undefined);
    mockClearMfaEnrolled.mockResolvedValue(undefined);
    mockClearRecoveryHashes.mockResolvedValue(undefined);
    mockDeletePasskey.mockResolvedValue(undefined);
    mockUpdatePasskeyCounter.mockResolvedValue(undefined);
    mockInsertPasskey.mockResolvedValue(undefined);
    mockConsumeChallenge.mockResolvedValue(true);
    mockIsChallengeUsable.mockReturnValue(true);
    mockDecodeClientDataChallenge.mockReturnValue('chal-1');
    mockUserHasMfa.mockResolvedValue(true);
    mockVerifyRecoveryCode.mockResolvedValue(true);
    mockCreateLoginTicket.mockResolvedValue('ticket-1');
    mockFindLoginTicket.mockResolvedValue({
      user_id: 'admin-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      used_at: null,
    });
    mockConsumeLoginTicket.mockResolvedValue(true);
    mockCreateAdminSessionMfa.mockResolvedValue({
      ok: true,
      token: 'mfa-session-token',
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  describe('GET /account/mfa/status', () => {
    it('returns enrolled state without leaking codes or credentials', async () => {
      mockGetMfaState.mockResolvedValue({ method: 'passkey', enrolledAt: '2026-08-13T00:00:00.000Z' });
      mockListPasskeys.mockResolvedValue([
        { id: 'pk-1', created_at: '2026-08-13T00:00:00.000Z' },
      ]);
      mockHasRecoveryCodes.mockResolvedValue(true);

      const res = await app.fetch(
        new Request(`${BASE}/status`, { headers: { Authorization: 'Bearer tok' } }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.mfaEnrolled).toBe(true);
      expect(body.data.method).toBe('passkey');
      expect(body.data.passkeys).toEqual([{ id: 'pk-1', createdAt: '2026-08-13T00:00:00.000Z' }]);
      expect(body.data.recoveryCodesPresent).toBe(true);
      // No credential material or plaintext codes are ever returned.
      expect(JSON.stringify(body.data)).not.toContain('publicKey');
      expect(JSON.stringify(body.data)).not.toContain('credential_id');
    });
  });

  describe('POST /account/mfa/register-start', () => {
    it('rejects a missing/incorrect current password with 401 and audits failure', async () => {
      mockVerifyAccountPassword.mockResolvedValue(false);
      mockSessionAssurance('step_up');

      const res = await app.fetch(
        new Request(`${BASE}/register-start`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'wrong' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(mockGenerateRegistrationOptions).not.toHaveBeenCalled();
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_enroll_failure' }),
        expect.anything(),
      );
    });

    it('generates registration options and stores a single-use challenge', async () => {
      mockSessionAssurance('step_up');
      mockListPasskeys.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'chal-xx' });

      const res = await app.fetch(
        new Request(`${BASE}/register-start`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'pass' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.options.challenge).toBe('chal-xx');
      expect(mockStoreChallenge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'chal-xx', purpose: 'registration', rawChallenge: 'chal-xx' }),
      );
    });
  });

  describe('POST /account/mfa/register-verify', () => {
    const response = { id: 'cred-1', response: { clientDataJSON: 'Zm9v' } };

    it('completes enrollment, generates recovery codes once, raises assurance, rotates + revokes sessions, audits', async () => {
      mockSessionAssurance('step_up');
      mockFindChallenge.mockResolvedValue(usableChallenge);
      mockHasRecoveryCodes.mockResolvedValue(false);
      mockCreateRecoveryCodes.mockResolvedValue({
        codes: ['aaaa', 'bbbb'],
        hashes: ['h1', 'h2'],
      });
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array(32), counter: 1, transports: [] },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          aaguid: 'aaguid-1',
        },
      });

      const res = await app.fetch(
        new Request(`${BASE}/register-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.token).toBe('rotated-token');
      expect(body.data.recoveryCodes).toEqual(['aaaa', 'bbbb']);
      expect(body.data.deviceId).toBe('cred-1');

      expect(mockInsertPasskey).toHaveBeenCalledWith(
        expect.anything(),
        'admin-1',
        expect.objectContaining({ credentialId: 'cred-1', counter: 1, deviceType: 'singleDevice' }),
      );
      expect(mockSetMfaEnrolled).toHaveBeenCalledWith(expect.anything(), 'admin-1', 'passkey');
      expect(mockConsumeChallenge).toHaveBeenCalledWith(expect.anything(), 'chal-1');
      expect(mockRaiseAdminAssurance).toHaveBeenCalledWith(expect.anything(), 'tok', 'mfa');
      expect(mockRevokeAllAdminSessionsForUser).toHaveBeenCalledWith(
        expect.anything(),
        'admin-1',
        expect.objectContaining({ exceptTokenHash: 'hash-of-token' }),
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_enroll' }),
        expect.anything(),
      );

      // Recovery codes were hashed at rest; plaintext equals hashes is impossible.
      expect(mockWriteRecoveryHashes).toHaveBeenCalledWith(
        expect.anything(),
        'admin-1',
        expect.not.arrayContaining(['aaaa', 'bbbb']),
      );
    });

    it('does not regenerate recovery codes when already present', async () => {
      mockSessionAssurance('step_up');
      mockFindChallenge.mockResolvedValue(usableChallenge);
      mockHasRecoveryCodes.mockResolvedValue(true);
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array(32), counter: 1, transports: [] },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          aaguid: 'aaguid-1',
        },
      });

      const res = await app.fetch(
        new Request(`${BASE}/register-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.recoveryCodes).toBeUndefined();
      expect(mockCreateRecoveryCodes).not.toHaveBeenCalled();
    });

    it('returns 400 INVALID_CHALLENGE for a used/expired challenge and does not verify', async () => {
      mockSessionAssurance('step_up');
      mockFindChallenge.mockResolvedValue(usableChallenge);
      mockIsChallengeUsable.mockReturnValue(false);

      const res = await app.fetch(
        new Request(`${BASE}/register-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CHALLENGE');
      expect(mockVerifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('returns 400 + consumes the challenge when verification throws (single-use on failure)', async () => {
      mockSessionAssurance('step_up');
      mockFindChallenge.mockResolvedValue(usableChallenge);
      mockVerifyRegistrationResponse.mockRejectedValue(new Error('bad attestation'));

      const res = await app.fetch(
        new Request(`${BASE}/register-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_REGISTRATION');
      expect(mockConsumeChallenge).toHaveBeenCalledWith(expect.anything(), 'chal-1');
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_enroll_failure' }),
        expect.anything(),
      );
    });
  });

  describe('POST /account/mfa/authenticate-verify', () => {
    const response = { id: 'cred-1', response: { clientDataJSON: 'Y2g' } };

    beforeEach(() => {
      mockFindChallenge.mockResolvedValue({ ...usableChallenge, purpose: 'authentication' });
      mockGetPasskeyByCredentialId.mockResolvedValue({
        id: 'row-1',
        user_id: 'admin-1',
        credential_id: 'cred-1',
        public_key: 'aW52YWxpZA',
        counter: 5,
        credential_device_type: 'singleDevice',
        credential_backed_up: 0,
        transports: null,
        aaguid: null,
        created_at: '2026-08-13T00:00:00.000Z',
        last_used_at: null,
      });
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { credentialID: 'cred-1', newCounter: 6, userVerified: true, credentialDeviceType: 'singleDevice', credentialBackedUp: false, origin: 'x', rpID: 'localhost' },
      });
    });

    it('raises assurance to mfa, rotates the token, updates the counter, and revokes other sessions', async () => {
      const res = await app.fetch(
        new Request(`${BASE}/authenticate-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.token).toBe('rotated-token');
      expect(mockRaiseAdminAssurance).toHaveBeenCalledWith(expect.anything(), 'tok', 'mfa');
      expect(mockUpdatePasskeyCounter).toHaveBeenCalledWith(expect.anything(), 'cred-1', 6);
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_auth_success' }),
        expect.anything(),
      );
    });

    it('is single-use: a second call with the same already-consumed challenge fails', async () => {
      mockIsChallengeUsable.mockReturnValue(false);

      const res = await app.fetch(
        new Request(`${BASE}/authenticate-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CHALLENGE');
      expect(mockVerifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    it('returns 401 MFA_FAILED and audits on a failed credential', async () => {
      mockGetPasskeyByCredentialId.mockResolvedValue(null);

      const res = await app.fetch(
        new Request(`${BASE}/authenticate-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_FAILED');
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_auth_failure' }),
        expect.anything(),
      );
    });
  });

  describe('DELETE /account/mfa/passkey/:id (requireMfa)', () => {
    it('returns 428 MFA_REQUIRED when the session is not mfa-assured', async () => {
      mockSessionAssurance('password');

      const res = await app.fetch(
        new Request(`${BASE}/passkey/pk-1`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'pass' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(428);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_REQUIRED');
      expect(res.headers.get('X-Mfa-Required')).toBe('true');
      expect(mockDeletePasskey).not.toHaveBeenCalled();
    });

    it('clears MFA state and recovery hashes when the last passkey is removed', async () => {
      mockSessionAssurance('mfa');
      mockGetPasskeyById.mockResolvedValue({ id: 'pk-1' });
      mockListPasskeys.mockResolvedValue([]);

      const res = await app.fetch(
        new Request(`${BASE}/passkey/pk-1`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'pass' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.mfaEnrolled).toBe(false);
      expect(mockDeletePasskey).toHaveBeenCalledWith(expect.anything(), 'pk-1', 'admin-1');
      expect(mockClearMfaEnrolled).toHaveBeenCalledWith(expect.anything(), 'admin-1');
      expect(mockClearRecoveryHashes).toHaveBeenCalledWith(expect.anything(), 'admin-1');
      expect(mockRaiseAdminAssurance).toHaveBeenCalledWith(expect.anything(), 'tok', 'step_up');
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_remove' }),
        expect.anything(),
      );
    });
  });

  describe('POST /account/mfa/recovery-codes/regenerate (requireMfa)', () => {
    it('requires mfa assurance + current password and returns fresh codes', async () => {
      mockSessionAssurance('mfa');
      mockCreateRecoveryCodes.mockResolvedValue({
        codes: ['c1', 'c2'],
        hashes: ['h1', 'h2'],
      });

      const res = await app.fetch(
        new Request(`${BASE}/recovery-codes/regenerate`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'pass' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.recoveryCodes).toEqual(['c1', 'c2']);
      expect(mockWriteRecoveryHashes).toHaveBeenCalled();
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'recovery_code_regenerated' }),
        expect.anything(),
      );
    });

    it('rejects without mfa assurance with 428', async () => {
      mockSessionAssurance('step_up');

      const res = await app.fetch(
        new Request(`${BASE}/recovery-codes/regenerate`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'pass' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(428);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_REQUIRED');
    });
  });

  describe('challenge ownership + purpose binding (ADR-234 gap closure)', () => {
    const regResponse = { id: 'cred-1', response: { clientDataJSON: 'Zm9v' } };
    const authResponse = { id: 'cred-1', response: { clientDataJSON: 'Y2g' } };

    it('register-verify rejects a challenge bound to the wrong purpose', async () => {
      mockSessionAssurance('step_up');
      mockFindChallenge.mockResolvedValue({ ...usableChallenge, purpose: 'authentication' });
      mockIsChallengeUsable.mockReturnValue(false);

      const res = await app.fetch(
        new Request(`${BASE}/register-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationResponse: regResponse }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CHALLENGE');
      expect(mockVerifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('authenticate-verify rejects a challenge not owned by the caller', async () => {
      mockFindChallenge.mockResolvedValue({ ...usableChallenge, user_id: 'other-user', purpose: 'authentication' });
      mockIsChallengeUsable.mockReturnValue(false);

      const res = await app.fetch(
        new Request(`${BASE}/authenticate-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticationResponse: authResponse }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CHALLENGE');
      expect(mockVerifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    it('authenticate-verify rejects a credential that belongs to another user (401 MFA_FAILED)', async () => {
      mockFindChallenge.mockResolvedValue({ ...usableChallenge, purpose: 'authentication' });
      mockGetPasskeyByCredentialId.mockResolvedValue({
        id: 'row-1',
        user_id: 'other-user',
        credential_id: 'cred-1',
        public_key: 'aW52YWxpZA',
        counter: 5,
        credential_device_type: 'singleDevice',
        credential_backed_up: 0,
        transports: null,
        aaguid: null,
        created_at: '2026-08-13T00:00:00.000Z',
        last_used_at: null,
      });

      const res = await app.fetch(
        new Request(`${BASE}/authenticate-verify`, {
          method: 'POST',
          headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticationResponse: authResponse }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_FAILED');
      expect(mockVerifyAuthenticationResponse).not.toHaveBeenCalled();
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_auth_failure', payload: expect.objectContaining({ reason: 'credential_not_owned' }) }),
        expect.anything(),
      );
    });
  });

  describe('POST /login/mfa/start (public login second factor)', () => {
    const LOGIN = 'http://localhost/api/admin/login/mfa/start';
    const userRow = { id: 'admin-1', email: 'admin@example.com', global_role: 'admin', disabled_at: null, compromised_at: null };

    it('returns authentication options bound to the email-resolved user', async () => {
      mockQueryFirst.mockResolvedValue(userRow);
      mockUserHasMfa.mockResolvedValue(true);
      mockListPasskeys.mockResolvedValue([{ credential_id: 'cred-1' }]);
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'chal-login' });

      const res = await app.fetch(
        new Request(LOGIN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.options.challenge).toBe('chal-login');
      expect(mockStoreChallenge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'admin-1', purpose: 'authentication', rawChallenge: 'chal-login' }),
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_auth_started' }),
        expect.anything(),
      );
    });

    it('returns uniform 401 MFA_REQUIRED when the account is not MFA-enrolled', async () => {
      mockQueryFirst.mockResolvedValue(userRow);
      mockUserHasMfa.mockResolvedValue(false);

      const res = await app.fetch(
        new Request(LOGIN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_REQUIRED');
      expect(mockGenerateAuthenticationOptions).not.toHaveBeenCalled();
    });

    it('refuses to start when the login ticket is absent, consumed, or expired (password factor required)', async () => {
      // A consumed/expired ticket means the password was never (or no longer
      // freshly) verified — the passkey ceremony must not proceed alone.
      mockFindLoginTicket.mockResolvedValue({ user_id: 'admin-1', expires_at: '2099-01-01T00:00:00.000Z', used_at: '2026-08-13T00:00:00.000Z' });

      const res = await app.fetch(
        new Request(LOGIN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_LOGIN_TICKET');
      expect(mockGenerateAuthenticationOptions).not.toHaveBeenCalled();
      expect(mockStoreChallenge).not.toHaveBeenCalled();
    });
  });

  describe('POST /login/mfa/verify (public passkey completion)', () => {
    const VERIFY = 'http://localhost/api/admin/login/mfa/verify';
    const response = { id: 'cred-1', response: { clientDataJSON: 'Y2g' } };
    const userRow = { id: 'admin-1', email: 'admin@example.com', global_role: 'admin', disabled_at: null, compromised_at: null };

    beforeEach(() => {
      mockQueryFirst.mockResolvedValue(userRow);
      mockUserHasMfa.mockResolvedValue(true);
      mockFindChallenge.mockResolvedValue({ ...usableChallenge, purpose: 'authentication' });
      mockGetPasskeyByCredentialId.mockResolvedValue({
        id: 'row-1',
        user_id: 'admin-1',
        credential_id: 'cred-1',
        public_key: 'aW52YWxpZA',
        counter: 5,
        credential_device_type: 'singleDevice',
        credential_backed_up: 0,
        transports: null,
        aaguid: null,
        created_at: '2026-08-13T00:00:00.000Z',
        last_used_at: null,
      });
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { credentialID: 'cred-1', newCounter: 6, userVerified: true, credentialDeviceType: 'singleDevice', credentialBackedUp: false, origin: 'x', rpID: 'localhost' },
      });
      mockCreateAdminSessionMfa.mockResolvedValue({
        ok: true,
        token: 'mfa-session-token',
        user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
      });
    });

    it('mints an mfa session and returns token/user on the happy path', async () => {
      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1', authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.token).toBe('mfa-session-token');
      expect(body.data.user.email).toBe('admin@example.com');
      expect(mockUpdatePasskeyCounter).toHaveBeenCalledWith(expect.anything(), 'cred-1', 6);
      expect(mockCreateAdminSessionMfa).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
        expect.objectContaining({ ipHash: expect.any(String), deviceLabelHash: expect.any(String) }),
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_auth_success' }),
        expect.anything(),
      );
    });

    it('is single-use: reusing a consumed challenge returns 400 INVALID_CHALLENGE', async () => {
      mockIsChallengeUsable.mockReturnValue(false);

      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1', authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CHALLENGE');
      expect(mockCreateAdminSessionMfa).not.toHaveBeenCalled();
    });

    it('fails closed for a disabled enrolled admin (ADR-231) and mints no session', async () => {
      mockQueryFirst.mockResolvedValue({ ...userRow, disabled_at: '2026-01-01T00:00:00.000Z' });

      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1', authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_REQUIRED');
      expect(mockCreateAdminSessionMfa).not.toHaveBeenCalled();
    });

    it('does not mint a session when the login ticket is already consumed (password factor single-use)', async () => {
      // Even with a valid passkey signature, an already-consumed login ticket
      // (password factor) must block the second session — single-use per /login.
      mockConsumeLoginTicket.mockResolvedValue(false);

      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: 'ticket-1', authenticationResponse: response }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_LOGIN_TICKET');
      expect(mockCreateAdminSessionMfa).not.toHaveBeenCalled();
    });
  });

  describe('POST /login/mfa/recovery-verify (public recovery redeem)', () => {
    const VERIFY = 'http://localhost/api/admin/login/mfa/recovery-verify';
    const userRow = { id: 'admin-1', email: 'admin@example.com', global_role: 'admin', disabled_at: null, compromised_at: null };

    beforeEach(() => {
      mockQueryFirst.mockResolvedValue(userRow);
      mockUserHasMfa.mockResolvedValue(true);
      mockVerifyAccountPassword.mockResolvedValue(true);
      mockVerifyRecoveryCode.mockResolvedValue(true);
      mockCreateAdminSessionMfa.mockResolvedValue({
        ok: true,
        token: 'recovery-token',
        user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
      });
    });

    it('requires both the password and a valid code, then mints an mfa session', async () => {
      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@example.com', password: 'password', recoveryCode: '0123456789abcdef' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.token).toBe('recovery-token');
      expect(body.data.user.email).toBe('admin@example.com');
      expect(mockVerifyAccountPassword).toHaveBeenCalledWith(expect.anything(), 'admin-1', 'password');
      expect(mockVerifyRecoveryCode).toHaveBeenCalledWith(expect.anything(), 'admin-1', '0123456789abcdef');
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_recovery_success' }),
        expect.anything(),
      );
    });

    it('returns 401 INVALID_CREDENTIALS when the recovery code is invalid', async () => {
      mockVerifyRecoveryCode.mockResolvedValue(false);

      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@example.com', password: 'password', recoveryCode: '0123456789abcdef' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(mockCreateAdminSessionMfa).not.toHaveBeenCalled();
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'mfa_recovery_failure' }),
        expect.anything(),
      );
    });

    it('fails closed for a compromised enrolled admin (ADR-231) with no session', async () => {
      mockQueryFirst.mockResolvedValue({ ...userRow, compromised_at: '2026-01-01T00:00:00.000Z' });

      const res = await app.fetch(
        new Request(VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@example.com', password: 'password', recoveryCode: '0123456789abcdef' }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error.code).toBe('MFA_REQUIRED');
      expect(mockVerifyRecoveryCode).not.toHaveBeenCalled();
      expect(mockCreateAdminSessionMfa).not.toHaveBeenCalled();
    });
  });
});
