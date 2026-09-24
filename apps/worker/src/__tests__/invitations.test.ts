import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';

const mocks = vi.hoisted(() => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  hashToken: vi.fn(),
  hashPassword: vi.fn(),
  isPasswordDerivative: vi.fn(),
}));

vi.mock('../db/client', () => ({
  queryFirst: mocks.queryFirst,
  queryAll: mocks.queryAll,
  execute: mocks.execute,
  transaction: mocks.transaction,
}));
vi.mock('../auth/session', () => ({ hashToken: mocks.hashToken }));
vi.mock('../auth/password', () => ({ hashPassword: mocks.hashPassword }));
vi.mock('../auth/account', () => ({ isPasswordDerivative: mocks.isPasswordDerivative }));

import {
  acceptBookInvitation,
  createBookInvitation,
  resendBookInvitation,
  revokeBookInvitation,
} from '../auth/invitations';

const BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeEnv(changes = 1): Env {
  const run = vi.fn().mockResolvedValue({ meta: { changes } });
  const statement = { bind: vi.fn(() => ({ run })) };
  const db = { prepare: vi.fn(() => statement) };
  return {
    DB: db as unknown as D1Database,
    APP_BASE_URL: 'https://app.example.com',
  } as unknown as Env;
}

function invitationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'invite-1',
    book_id: BOOK_ID,
    email: 'creator@example.com',
    role: 'creator',
    status: 'pending',
    delivery_status: 'pending',
    delivery_error_code: null,
    user_id: null,
    grant_id: null,
    grant_mode: 'editorial_review',
    comments_allowed: 1,
    offline_allowed: 1,
    grant_expires_at: null,
    expires_at: '2099-01-01T00:00:00.000Z',
    created_by_user_id: 'admin-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    accepted_at: null,
    revoked_at: null,
    book_slug: 'book',
    book_title: 'Book',
    book_author_name: null,
    book_cover_image_url: null,
    book_visibility: 'private',
    book_archived_at: null,
    ...overrides,
  };
}

describe('book invitation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashToken.mockResolvedValue('hashed-token');
    mocks.hashPassword.mockResolvedValue('argon2id-hash');
    mocks.isPasswordDerivative.mockReturnValue(false);
    mocks.transaction.mockResolvedValue(undefined);
  });

  it('normalizes email and stores only the invitation token hash', async () => {
    mocks.queryFirst
      .mockResolvedValueOnce({ id: BOOK_ID })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const env = makeEnv();
    const result = await createBookInvitation(
      env,
      {
        bookId: BOOK_ID,
        email: 'Reader@Example.com',
        role: 'reader',
        mode: 'private',
        commentsAllowed: false,
        offlineAllowed: false,
      },
      'admin-1',
    );

    expect(result.invitation.email).toBe('reader@example.com');
    const statements = mocks.transaction.mock.calls[0][1] as Array<{
      sql: string;
      args: unknown[];
    }>;
    const insert = statements.find((statement) =>
      statement.sql.includes('INSERT INTO book_invitations'),
    );
    expect(insert?.args).toContain('reader@example.com');
    expect(insert?.args).toContain('hashed-token');
    expect(insert?.args).not.toContain(result.rawToken);
  });

  it('accepts a creator invitation and creates user, grant, and assignment together', async () => {
    mocks.queryFirst
      .mockResolvedValueOnce(invitationRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'accepted' });
    const env = makeEnv();
    const result = await acceptBookInvitation(env, {
      token: 'a'.repeat(64),
      newPassword: 'A-long-invite-passphrase!',
      newPasswordConfirm: 'A-long-invite-passphrase!',
    });

    expect(result.role).toBe('creator');
    const statements = mocks.transaction.mock.calls[0][1] as Array<{
      sql: string;
      args: unknown[];
    }>;
    expect(statements.some((statement) => statement.sql.includes('INSERT INTO users'))).toBe(true);
    expect(
      statements.some((statement) => statement.sql.includes('INSERT INTO book_access_grants')),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.sql.includes('INSERT OR IGNORE INTO book_creators')),
    ).toBe(true);
    expect(statements.some((statement) => statement.args.includes('argon2id-hash'))).toBe(true);
  });

  it('rejects a grant expiry that is already in the past', async () => {
    mocks.queryFirst.mockResolvedValueOnce({ id: BOOK_ID });
    await expect(
      createBookInvitation(
        makeEnv(),
        {
          bookId: BOOK_ID,
          email: 'reader@example.com',
          role: 'reader',
          mode: 'private',
          commentsAllowed: false,
          offlineAllowed: false,
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
        'admin-1',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_GRANT_EXPIRY' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses to create a second invitation over an active grant', async () => {
    mocks.queryFirst
      .mockResolvedValueOnce({ id: BOOK_ID })
      .mockResolvedValueOnce({ id: 'grant-1', allowed: 1, revoked_at: null });
    await expect(
      createBookInvitation(
        makeEnv(),
        {
          bookId: BOOK_ID,
          email: 'reader@example.com',
          role: 'reader',
          mode: 'private',
          commentsAllowed: false,
          offlineAllowed: false,
        },
        'admin-1',
      ),
    ).rejects.toMatchObject({ code: 'INVITATION_CONFLICT' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('resends a pending invitation with a fresh token hash', async () => {
    mocks.queryFirst.mockResolvedValueOnce(invitationRow());
    const result = await resendBookInvitation(makeEnv(), BOOK_ID, 'invite-1');
    expect(result.rawToken).not.toBe('hashed-token');
    expect(mocks.hashToken).toHaveBeenCalledWith(result.rawToken);
  });

  it('rejects a replayed claim after hashing but before the transaction', async () => {
    mocks.queryFirst
      .mockResolvedValueOnce(invitationRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(
      acceptBookInvitation(makeEnv(0), {
        token: 'a'.repeat(64),
        newPassword: 'A-long-invite-passphrase!',
        newPasswordConfirm: 'A-long-invite-passphrase!',
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(mocks.hashPassword).toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects an email-derived password before claiming the invitation', async () => {
    mocks.queryFirst.mockResolvedValueOnce(invitationRow());
    mocks.isPasswordDerivative.mockReturnValue(true);
    await expect(
      acceptBookInvitation(makeEnv(), {
        token: 'a'.repeat(64),
        newPassword: 'creator@example.com-Password!',
        newPasswordConfirm: 'creator@example.com-Password!',
      }),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it('rejects an expired invitation before hashing or claiming it', async () => {
    mocks.queryFirst.mockResolvedValueOnce(
      invitationRow({ expires_at: '2020-01-01T00:00:00.000Z' }),
    );
    await expect(
      acceptBookInvitation(makeEnv(), {
        token: 'a'.repeat(64),
        newPassword: 'A-long-invite-passphrase!',
        newPasswordConfirm: 'A-long-invite-passphrase!',
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('removes a creator assignment when an accepted invitation is revoked', async () => {
    mocks.queryFirst.mockResolvedValueOnce(
      invitationRow({
        status: 'accepted',
        user_id: 'user-1',
        grant_id: 'grant-1',
      }),
    );
    await revokeBookInvitation(makeEnv(), BOOK_ID, 'invite-1');
    const statements = mocks.transaction.mock.calls[0][1] as Array<{ sql: string }>;
    expect(
      statements.some((statement) => statement.sql.includes('DELETE FROM book_creators')),
    ).toBe(true);
    expect(statements.some((statement) => statement.sql.includes('UPDATE reader_sessions'))).toBe(
      true,
    );
  });
});
