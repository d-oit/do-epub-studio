import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

/** Error shape surfaced by apiRequest for a !ok response (see lib/api/core.ts). */
export interface MfaApiError extends Error {
  code?: string;
  status?: number;
}

/** True when the server requires MFA (428 MFA_REQUIRED) before a guarded mutation. */
export function isMfaRequired(err: unknown): boolean {
  return (err as MfaApiError)?.code === 'MFA_REQUIRED';
}

export interface AdminMfaStatus {
  mfaEnrolled: boolean;
  method: string | null;
  enrolledAt: string | null;
  passkeys: { id: string; displayName: string | null; createdAt: string }[];
  recoveryCodesPresent: boolean;
}

export interface PasskeyEnrollResult {
  token: string;
  recoveryCodes: string[] | undefined;
  deviceId: string;
}

function currentToken(): string | undefined {
  return useAuthStore.getState().sessionToken ?? undefined;
}

/** fetch MFA enrollment status for the current admin. */
export async function fetchMfaStatus(): Promise<AdminMfaStatus> {
  return apiRequest<AdminMfaStatus>('/api/admin/account/mfa/status', {
    token: currentToken(),
  });
}

/**
 * Run the WebAuthn registration ceremony against a freshly-started server
 * challenge. Returns the rotated token, any newly issued recovery codes, and
 * the enrolled credential id.
 */
export async function performPasskeyEnroll(currentPassword: string, displayName?: string): Promise<PasskeyEnrollResult> {
  const token = currentToken();
  const start = await apiRequest<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    '/api/admin/account/mfa/register-start',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ currentPassword, displayName }),
    },
  );

  const response = await startRegistration({ optionsJSON: start.options });
  const data = await apiRequest<PasskeyEnrollResult>('/api/admin/account/mfa/register-verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ registrationResponse: response, deviceName: displayName || undefined }),
  });

  useAuthStore.getState().refreshSession({ sessionToken: data.token });
  return data;
}

/**
 * Run the WebAuthn authentication ceremony (passkey step-up to `mfa`
 * assurance). Returns the rotated bearer token.
 */
export async function performPasskeyAuth(): Promise<string> {
  const token = currentToken();
  const start = await apiRequest<{ options: PublicKeyCredentialRequestOptionsJSON }>(
    '/api/admin/account/mfa/authenticate-start',
    { token },
  );

  const response = await startAuthentication({ optionsJSON: start.options });
  const data = await apiRequest<{ token: string }>('/api/admin/account/mfa/authenticate-verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ authenticationResponse: response }),
  });

  useAuthStore.getState().refreshSession({ sessionToken: data.token });
  return data.token;
}

/** Remove an enrolled passkey (requires current password + `mfa` assurance). */
export async function removePasskey(id: string, currentPassword: string): Promise<{ mfaEnrolled: boolean }> {
  return apiRequest<{ mfaEnrolled: boolean }>(`/api/admin/account/mfa/passkey/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token: currentToken(),
    body: JSON.stringify({ currentPassword }),
  });
}

/** Regenerate single-use recovery codes (requires current password + `mfa` assurance). */
export async function regenerateRecoveryCodes(currentPassword: string): Promise<{ recoveryCodes: string[]; token?: string }> {
  const data = await apiRequest<{ recoveryCodes: string[]; token?: string }>(
    '/api/admin/account/mfa/recovery-codes/regenerate',
    {
      method: 'POST',
      token: currentToken(),
      body: JSON.stringify({ currentPassword }),
    },
  );
  if (data.token) {
    useAuthStore.getState().refreshSession({ sessionToken: data.token });
  }
  return data;
}
