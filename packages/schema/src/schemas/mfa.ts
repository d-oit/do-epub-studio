import { z } from 'zod';

// =============================================================================
// ADR-234 items 5+6: WebAuthn passkey enrollment/removal + recovery codes.
// =============================================================================

/** Start a passkey registration ceremony (requires current password + step-up). */
export const MfaRegisterStartSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  displayName: z.string().max(120).optional(),
});

export type MfaRegisterStart = z.infer<typeof MfaRegisterStartSchema>;

/**
 * Minimal structural guard for simplewebauthn's browser response JSON before it
 * is handed to verify*Response. Requires the fields the verify path
 * dereferences (id + response.clientDataJSON) so a structurally-invalid body
 * fails Zod validation with a clean 400 instead of an unhandled TypeError at
 * the handler. The public /login/mfa/verify path is reachable pre-session, so
 * this guard is load-bearing. `.passthrough()` preserves the remaining
 * browser-produced fields that simplewebauthn needs.
 */
export const WebAuthnResponseSchema = z
  .object({
    id: z.string().min(1),
    response: z.object({ clientDataJSON: z.string().min(1) }).passthrough(),
  })
  .passthrough();

/** Finish a passkey registration ceremony with the browser's response. */
export const MfaRegisterVerifySchema = z.object({
  registrationResponse: WebAuthnResponseSchema,
  deviceName: z.string().max(120).optional(),
});

export type MfaRegisterVerify = z.infer<typeof MfaRegisterVerifySchema>;

/** Finish a passkey authentication (step-up to `mfa`) ceremony. */
export const MfaAuthenticateVerifySchema = z.object({
  authenticationResponse: WebAuthnResponseSchema,
});

export type MfaAuthenticateVerify = z.infer<typeof MfaAuthenticateVerifySchema>;

/** Remove an enrolled passkey (requires current password + `mfa` assurance). */
export const MfaRemoveSchema = z.object({
  currentPassword: z.string().min(1).max(255),
});

export type MfaRemove = z.infer<typeof MfaRemoveSchema>;

/** Regenerate recovery codes (requires current password + `mfa` assurance). */
export const RecoveryCodeRegenSchema = z.object({
  currentPassword: z.string().min(1).max(255),
});

export type RecoveryCodeRegen = z.infer<typeof RecoveryCodeRegenSchema>;
