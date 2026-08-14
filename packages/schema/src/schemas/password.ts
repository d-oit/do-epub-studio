import { z } from 'zod';

/**
 * Shared password policy (ADR-231). Allows long passphrases, blocks known weak
 * values, and avoids composition rules. Service-name/email-derivative rejection
 * is enforced at the route layer where the account email is known.
 */
// Static membership lookup keyed by lowercase password (ts-set-map: use a
// Record<string, true> for small static string-keyed tables, not a Set).
const KNOWN_WEAK_PASSWORDS: Record<string, true> = {
  '12345678': true,
  '123456789': true,
  password: true,
  password1: true,
  password123: true,
  qwerty123: true,
  letmein: true,
  welcome: true,
  admin123: true,
  iloveyou: true,
  abc12345: true,
  monkey123: true,
  dragon123: true,
  superman: true,
  '1q2w3e4r': true,
  changeme: true,
  passw0rd: true,
};

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((pw) => pw.trim().length > 0, 'Password cannot be blank')
  .refine((pw) => !/^(.)\1{7,}$/.test(pw), 'Password is too simple')
  .refine(
    (pw) => KNOWN_WEAK_PASSWORDS[pw.toLowerCase()] !== true,
    'Password is too common/weak',
  );

export type Password = z.infer<typeof PasswordSchema>;

/**
 * Admin password-reset verification contract (ADR-232). Replaces the broken
 * token-only recovery-verify with a real reset that requires the new password
 * and its confirmation. The worker must only update the password hash after the
 * persisted single-use reset token has been verified.
 */
export const AdminRecoveryVerifySchema = z
  .object({
    token: z.string().min(1),
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type AdminRecoveryVerify = z.infer<typeof AdminRecoveryVerifySchema>;

/** Authenticated password change (requires the current password). */
export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(255),
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type PasswordChange = z.infer<typeof PasswordChangeSchema>;

/** Step-up reauthentication (ADR-234): re-confirm the current password. */
export const StepUpSchema = z.object({
  currentPassword: z.string().min(1).max(255),
});

export type StepUp = z.infer<typeof StepUpSchema>;

/** Set a password after verify (no current-password requirement). */
export const SetPasswordSchema = z
  .object({
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type SetPassword = z.infer<typeof SetPasswordSchema>;
