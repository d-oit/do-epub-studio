import { describe, it, expect } from 'vitest';
import {
  StepUpSchema,
  MfaRegisterStartSchema,
  MfaRegisterVerifySchema,
  MfaAuthenticateVerifySchema,
  MfaRemoveSchema,
  RecoveryCodeRegenSchema,
  RecoveryVerifyLoginSchema,
  LoginMfaVerifySchema,
  LoginMfaStartSchema,
  SetPasswordSchema,
} from '../schemas';

describe('MFA schemas (ADR-234 items 5+6)', () => {
  it('StepUpSchema accepts a current password and rejects blank/overlong values', () => {
    expect(StepUpSchema.parse({ currentPassword: 'x' })).toEqual({ currentPassword: 'x' });
    expect(() => StepUpSchema.parse({ currentPassword: '' })).toThrow();
    expect(() => StepUpSchema.parse({ currentPassword: 'x'.repeat(256) })).toThrow();
  });

  it('MfaRegisterStartSchema requires a password and allows an optional displayName', () => {
    expect(() => MfaRegisterStartSchema.parse({})).toThrow();
    expect(MfaRegisterStartSchema.parse({ currentPassword: 'p' })).toEqual({ currentPassword: 'p' });
    expect(MfaRegisterStartSchema.parse({ currentPassword: 'p', displayName: 'Laptop' })).toEqual({
      currentPassword: 'p',
      displayName: 'Laptop',
    });
    expect(() => MfaRegisterStartSchema.parse({ currentPassword: '', displayName: 'x' })).toThrow();
    expect(() => MfaRegisterStartSchema.parse({ currentPassword: 'p', displayName: 'x'.repeat(121) })).toThrow();
  });

  it('MfaRegisterVerifySchema requires a structurally valid WebAuthn response (id + response.clientDataJSON)', () => {
    expect(() => MfaRegisterVerifySchema.parse({})).toThrow();
    expect(MfaRegisterVerifySchema.parse({ registrationResponse: { id: 'a', response: { clientDataJSON: 'b' } } }))
      .toEqual({ registrationResponse: { id: 'a', response: { clientDataJSON: 'b' } } });
    // Structurally-invalid responses (missing response or clientDataJSON) must
    // be rejected rather than crash the handler with a 500 on the verify path.
    expect(() => MfaRegisterVerifySchema.parse({ registrationResponse: { id: 'a' } })).toThrow();
    expect(() => MfaRegisterVerifySchema.parse({ registrationResponse: {} })).toThrow();
    expect(() => MfaRegisterVerifySchema.parse({ registrationResponse: null })).toThrow();
  });

  it('MfaAuthenticateVerifySchema requires a structurally valid WebAuthn response', () => {
    expect(() => MfaAuthenticateVerifySchema.parse({})).toThrow();
    expect(MfaAuthenticateVerifySchema.parse({ authenticationResponse: { id: 'a', response: { clientDataJSON: 'b' } } }))
      .toEqual({ authenticationResponse: { id: 'a', response: { clientDataJSON: 'b' } } });
    expect(() => MfaAuthenticateVerifySchema.parse({ authenticationResponse: { id: 'a' } })).toThrow();
    expect(() => MfaAuthenticateVerifySchema.parse({ authenticationResponse: 'not-an-object' })).toThrow();
  });

  it('MfaAuthenticateVerifySchema preserves extra browser fields (passthrough) for simplewebauthn', () => {
    const parsed = MfaAuthenticateVerifySchema.parse({
      authenticationResponse: {
        id: 'a',
        response: { clientDataJSON: 'b', attestationObject: 'c' },
        rawId: 'raw',
        type: 'public-key',
      },
    });
    expect(parsed.authenticationResponse).toMatchObject({
      id: 'a',
      response: { clientDataJSON: 'b', attestationObject: 'c' },
    });
  });

  it('MfaRemoveSchema requires a current password and rejects blank/overlong values', () => {
    expect(() => MfaRemoveSchema.parse({})).toThrow();
    expect(MfaRemoveSchema.parse({ currentPassword: 'p' })).toEqual({ currentPassword: 'p' });
    expect(() => MfaRemoveSchema.parse({ currentPassword: '' })).toThrow();
    expect(() => MfaRemoveSchema.parse({ currentPassword: 'x'.repeat(256) })).toThrow();
  });

  it('RecoveryCodeRegenSchema requires a current password and rejects blank/overlong values', () => {
    expect(() => RecoveryCodeRegenSchema.parse({})).toThrow();
    expect(RecoveryCodeRegenSchema.parse({ currentPassword: 'p' })).toEqual({ currentPassword: 'p' });
    expect(() => RecoveryCodeRegenSchema.parse({ currentPassword: '' })).toThrow();
  });

  it('RecoveryVerifyLoginSchema requires email + password + recovery code and rejects invalid values', () => {
    expect(RecoveryVerifyLoginSchema.parse({ email: 'a@b.com', password: 'pw', recoveryCode: '1234567890123456' }))
      .toEqual({ email: 'a@b.com', password: 'pw', recoveryCode: '1234567890123456' });
    // Invalid email.
    expect(() => RecoveryVerifyLoginSchema.parse({ email: 'not-an-email', password: 'pw', recoveryCode: '1234567890123456' })).toThrow();
    // Blank / too-short recovery code.
    expect(() => RecoveryVerifyLoginSchema.parse({ email: 'a@b.com', password: 'pw', recoveryCode: '' })).toThrow();
    expect(() => RecoveryVerifyLoginSchema.parse({ email: 'a@b.com', password: 'pw', recoveryCode: '123' })).toThrow();
    // Overlong recovery code.
    expect(() => RecoveryVerifyLoginSchema.parse({ email: 'a@b.com', password: 'pw', recoveryCode: '1'.repeat(65) })).toThrow();
    // Missing fields.
    expect(() => RecoveryVerifyLoginSchema.parse({ email: 'a@b.com', recoveryCode: '1234567890123456' })).toThrow();
  });

  it('LoginMfaStartSchema requires a login ticket', () => {
    expect(() => LoginMfaStartSchema.parse({})).toThrow();
    expect(LoginMfaStartSchema.parse({ loginTicket: 't-1' })).toEqual({ loginTicket: 't-1' });
    expect(() => LoginMfaStartSchema.parse({ loginTicket: '' })).toThrow();
    expect(() => LoginMfaStartSchema.parse({ loginTicket: 'x'.repeat(256) })).toThrow();
  });

  it('LoginMfaVerifySchema requires a login ticket + structurally valid WebAuthn response', () => {
    expect(LoginMfaVerifySchema.parse({ loginTicket: 't-1', authenticationResponse: { id: 'a', response: { clientDataJSON: 'b' } } }))
      .toEqual({ loginTicket: 't-1', authenticationResponse: { id: 'a', response: { clientDataJSON: 'b' } } });
    expect(() => LoginMfaVerifySchema.parse({ authenticationResponse: { id: 'a', response: { clientDataJSON: 'b' } } })).toThrow();
    expect(() => LoginMfaVerifySchema.parse({ loginTicket: 't-1', authenticationResponse: {} })).toThrow();
    expect(() => LoginMfaVerifySchema.parse({ loginTicket: 't-1', authenticationResponse: 'nope' })).toThrow();
  });

  it('SetPasswordSchema requires matching new passwords', () => {
    expect(SetPasswordSchema.parse({ newPassword: 'password-123', newPasswordConfirm: 'password-123' }))
      .toEqual({ newPassword: 'password-123', newPasswordConfirm: 'password-123' });
    expect(() => SetPasswordSchema.parse({ newPassword: 'password-123', newPasswordConfirm: 'password-124' })).toThrow();
    expect(() => SetPasswordSchema.parse({ newPassword: 'short', newPasswordConfirm: 'short' })).toThrow();
  });
});
