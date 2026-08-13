import { describe, it, expect } from 'vitest';
import {
  PasswordSchema,
  AdminRecoveryVerifySchema,
  PasswordChangeSchema,
  SetPasswordSchema,
  StepUpSchema,
  EmailVerifyRequestSchema,
} from '../schemas';

const STRONG = 'Tr0ub4dor&3!passphrase';

describe('PasswordSchema (ADR-231 password policy)', () => {
  it('accepts a long passphrase', () => {
    expect(PasswordSchema.parse(STRONG)).toBe(STRONG);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => PasswordSchema.parse('short')).toThrow();
  });

  it('rejects a password longer than 128 characters', () => {
    expect(() => PasswordSchema.parse('a'.repeat(129))).toThrow();
  });

  it('rejects a blank/whitespace-only password', () => {
    expect(() => PasswordSchema.parse('        ')).toThrow();
  });

  it('rejects a single repeated character', () => {
    expect(() => PasswordSchema.parse('aaaaaaaa')).toThrow();
  });

  it('rejects a known weak password (case-insensitive)', () => {
    expect(() => PasswordSchema.parse('Password123')).toThrow();
  });
});

describe('AdminRecoveryVerifySchema (ADR-232)', () => {
  it('accepts token + matching new password + confirm', () => {
    const result = AdminRecoveryVerifySchema.parse({
      token: 'abc123',
      newPassword: STRONG,
      newPasswordConfirm: STRONG,
    });
    expect(result.token).toBe('abc123');
  });

  it('rejects when passwords do not match', () => {
    expect(() =>
      AdminRecoveryVerifySchema.parse({
        token: 'abc123',
        newPassword: STRONG,
        newPasswordConfirm: 'Different99!',
      }),
    ).toThrow();
  });

  it('rejects a weak new password even when confirmation matches', () => {
    expect(() =>
      AdminRecoveryVerifySchema.parse({
        token: 'abc123',
        newPassword: 'password',
        newPasswordConfirm: 'password',
      }),
    ).toThrow();
  });

  it('rejects an empty token', () => {
    expect(() =>
      AdminRecoveryVerifySchema.parse({
        token: '',
        newPassword: STRONG,
        newPasswordConfirm: STRONG,
      }),
    ).toThrow();
  });
});

describe('PasswordChangeSchema (ADR-231)', () => {
  it('accepts current + new password + confirm', () => {
    const result = PasswordChangeSchema.parse({
      currentPassword: 'oldPass1!',
      newPassword: STRONG,
      newPasswordConfirm: STRONG,
    });
    expect(result.currentPassword).toBe('oldPass1!');
  });

  it('rejects mismatched new passwords', () => {
    expect(() =>
      PasswordChangeSchema.parse({
        currentPassword: 'oldPass1!',
        newPassword: STRONG,
        newPasswordConfirm: 'Nope99!',
      }),
    ).toThrow();
  });

  it('rejects a missing current password', () => {
    expect(() =>
      PasswordChangeSchema.parse({
        currentPassword: '',
        newPassword: STRONG,
        newPasswordConfirm: STRONG,
      }),
    ).toThrow();
  });
});

describe('SetPasswordSchema (ADR-231)', () => {
  it('accepts matching new password + confirm', () => {
    const result = SetPasswordSchema.parse({ newPassword: STRONG, newPasswordConfirm: STRONG });
    expect(result.newPassword).toBe(STRONG);
  });

  it('rejects mismatched confirmation', () => {
    expect(() =>
      SetPasswordSchema.parse({ newPassword: STRONG, newPasswordConfirm: 'Xyz99!' }),
    ).toThrow();
  });
});

describe('StepUpSchema (ADR-234)', () => {
  it('accepts a current password', () => {
    const result = StepUpSchema.parse({ currentPassword: 'secretPass1' });
    expect(result.currentPassword).toBe('secretPass1');
  });

  it('rejects an empty current password', () => {
    expect(() => StepUpSchema.parse({ currentPassword: '' })).toThrow();
  });
});

describe('EmailVerifyRequestSchema (ADR-231)', () => {
  it('accepts a token', () => {
    const result = EmailVerifyRequestSchema.parse({ token: 'vt-123' });
    expect(result.token).toBe('vt-123');
  });

  it('rejects an empty token', () => {
    expect(() => EmailVerifyRequestSchema.parse({ token: '' })).toThrow();
  });
});
