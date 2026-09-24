import { describe, expect, it } from 'vitest';
import {
  AcceptBookInvitationSchema,
  CreateBookInvitationSchema,
  InvitationDeliveryStatusSchema,
  InvitationRoleSchema,
  InvitationStatusSchema,
} from '../schemas';

const BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';
const TOKEN = 'a'.repeat(64);
const PASSWORD = 'A-long-invite-passphrase!';

describe('book invitation schemas', () => {
  it('applies safe reader defaults', () => {
    const result = CreateBookInvitationSchema.parse({
      bookId: BOOK_ID,
      email: 'reader@example.com',
    });
    expect(result.role).toBe('reader');
    expect(result.mode).toBe('private');
    expect(result.commentsAllowed).toBe(false);
    expect(result.offlineAllowed).toBe(false);
  });

  it('accepts a creator invitation with capabilities', () => {
    const result = CreateBookInvitationSchema.parse({
      bookId: BOOK_ID,
      email: 'creator@example.com',
      role: 'creator',
      mode: 'editorial_review',
      commentsAllowed: true,
      offlineAllowed: true,
    });
    expect(result.role).toBe('creator');
    expect(result.mode).toBe('editorial_review');
  });

  it('rejects an invalid role, book id, and email', () => {
    expect(() => CreateBookInvitationSchema.parse({ bookId: 'bad', email: 'not-an-email', role: 'owner' })).toThrow();
  });

  it('accepts a matching invitation password', () => {
    const result = AcceptBookInvitationSchema.parse({
      token: TOKEN,
      newPassword: PASSWORD,
      newPasswordConfirm: PASSWORD,
    });
    expect(result.token).toBe(TOKEN);
  });

  it('rejects mismatched passwords and short tokens', () => {
    expect(() => AcceptBookInvitationSchema.parse({
      token: TOKEN,
      newPassword: PASSWORD,
      newPasswordConfirm: 'Different-passphrase!',
    })).toThrow();
    expect(() => AcceptBookInvitationSchema.parse({
      token: 'short',
      newPassword: PASSWORD,
      newPasswordConfirm: PASSWORD,
    })).toThrow();
  });

  it('keeps lifecycle enums explicit', () => {
    expect(InvitationRoleSchema.options).toEqual(['reader', 'creator']);
    expect(InvitationStatusSchema.options).toContain('processing');
    expect(InvitationDeliveryStatusSchema.options).toContain('manual_copy_required');
  });
});
