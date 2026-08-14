import { z } from 'zod';
import { WebAuthnResponseSchema } from './mfa';

export const AccessRequestSchema = z.object({
  bookSlug: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().max(255).optional(),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;

export const RecoveryRequestSchema = z.object({
  bookSlug: z.string().min(1).max(255),
  email: z.string().email().max(255),
});

export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;

export const AdminRecoveryRequestSchema = z.object({
  email: z.string().email().max(255),
});

export type AdminRecoveryRequest = z.infer<typeof AdminRecoveryRequestSchema>;

export const RecoveryVerifySchema = z.object({
  token: z.string().min(1),
});

export type RecoveryVerify = z.infer<typeof RecoveryVerifySchema>;

/** Email verification token (ADR-231 account lifecycle). */
export const EmailVerifyRequestSchema = z.object({
  token: z.string().min(1),
});

export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

/**
 * Login-time MFA recovery redeem (ADR-234): pair the account password with a
 * single-use recovery code to obtain a session when the passkey is lost. The
 * code is never used alone — it always requires the account password.
 */
export const RecoveryVerifyLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
  recoveryCode: z.string().min(16).max(64),
});

export type RecoveryVerifyLogin = z.infer<typeof RecoveryVerifyLoginSchema>;

/**
 * Login-time passkey second-factor completion (ADR-234): the short-lived
 * single-use login ticket issued by a successful password /login (factor 1)
 * plus the browser's WebAuthn authentication response (factor 2). The ticket
 * proves the password was verified — /login/mfa/* never mints a session from a
 * passkey alone.
 */
export const LoginMfaVerifySchema = z.object({
  loginTicket: z.string().min(1).max(255),
  authenticationResponse: WebAuthnResponseSchema,
});

export type LoginMfaVerify = z.infer<typeof LoginMfaVerifySchema>;

/**
 * Starts the login-time passkey ceremony against a verified password. Requires
 * the single-use login ticket returned by /login when MFA is mandatory, so the
 * password factor always precedes the passkey factor and account/credential
 * state is not disclosed to an unauthenticated caller.
 */
export const LoginMfaStartSchema = z.object({
  loginTicket: z.string().min(1).max(255),
});

export type LoginMfaStart = z.infer<typeof LoginMfaStartSchema>;
