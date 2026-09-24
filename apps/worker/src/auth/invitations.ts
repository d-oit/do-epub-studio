import type { Env } from '../lib/env';
import { execute, queryFirst, transaction } from '../db/client';
import { hashPassword } from './password';
import { isPasswordDerivative } from './account';
import { hashToken } from './session';
import { cleanupAcceptanceRace } from './invitation-cleanup';
import { AppError } from '../lib/http-errors';
import type {
  AcceptBookInvitation,
  InvitationRole,
  InvitationStatus,
} from '@do-epub-studio/schema';
import {
  claimInvitation,
  grantForBookEmail,
  pendingUser,
  type InvitationBookRow,
} from './invitation-store';

export {
  createBookInvitation,
  listBookInvitations,
  resendBookInvitation,
  revokeBookInvitation,
  setInvitationDeliveryStatus,
} from './invitation-store';

export interface AcceptedInvitation {
  invitationId: string;
  userId: string;
  grantId: string;
  bookId: string;
  email: string;
  role: InvitationRole;
}

function findByToken(env: Env, tokenHash: string): Promise<InvitationBookRow | null> {
  return findInvitationByToken(env, tokenHash);
}

async function findInvitationByToken(
  env: Env,
  tokenHash: string,
): Promise<InvitationBookRow | null> {
  return queryFirst<InvitationBookRow>(
    env,
    `SELECT bi.id, bi.book_id, bi.email, bi.role, bi.status,
      bi.delivery_status, bi.delivery_attempted_at, bi.delivery_error_code,
      bi.user_id, bi.grant_id, bi.grant_mode, bi.comments_allowed,
      bi.offline_allowed, bi.grant_expires_at, bi.expires_at,
      bi.created_by_user_id, bi.created_at, bi.updated_at, bi.accepted_at,
      bi.revoked_at, b.slug AS book_slug, b.title AS book_title,
      b.author_name AS book_author_name, b.cover_image_url AS book_cover_image_url,
      b.visibility AS book_visibility, b.archived_at AS book_archived_at
     FROM book_invitations bi
     JOIN books b ON b.id = bi.book_id
     WHERE bi.token_hash = ? LIMIT 1`,
    [tokenHash],
  );
}

export async function acceptBookInvitation(
  env: Env,
  input: AcceptBookInvitation,
): Promise<AcceptedInvitation> {
  const tokenHash = await hashToken(input.token);
  const invitation = await findByToken(env, tokenHash);
  if (
    !invitation ||
    invitation.book_archived_at ||
    invitation.status !== 'pending' ||
    new Date(invitation.expires_at) <= new Date()
  ) {
    throw new AppError('This invitation is invalid or expired', 'INVITATION_INVALID', 410);
  }
  if (isPasswordDerivative(input.newPassword, invitation.email)) {
    throw new AppError('Password is too similar to the email address', 'WEAK_PASSWORD', 400);
  }

  const existingGrant = await grantForBookEmail(env, invitation.book_id, invitation.email);
  if (existingGrant && existingGrant.allowed === 1 && !existingGrant.revoked_at) {
    throw new AppError(
      'This email already has active access to this book',
      'INVITATION_CONFLICT',
      409,
    );
  }
  const existingUser = await pendingUser(env, invitation.email);
  if (existingUser && (existingUser.disabled_at || existingUser.compromised_at)) {
    throw new AppError('This invitation cannot be accepted', 'INVITATION_INVALID', 410);
  }

  const passwordHash = await hashPassword(input.newPassword);
  if (!(await claimInvitation(env, invitation.id))) {
    throw new AppError('This invitation is invalid or expired', 'INVITATION_INVALID', 410);
  }

  const userId = existingUser?.id ?? crypto.randomUUID();
  const grantId = existingGrant?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [];

  if (!existingUser) {
    statements.push({
      sql: `INSERT INTO users
        (id, email, display_name, global_role, password_hash, email_verified_at, created_at, updated_at)
        VALUES (?, ?, NULL, 'reader', NULL, NULL, ?, ?)`,
      args: [userId, invitation.email, now, now],
    });
  } else {
    statements.push({
      sql: `UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?`,
      args: [now, now, userId],
    });
  }

  if (existingGrant) {
    statements.push({
      sql: `UPDATE book_access_grants
        SET password_hash = ?, mode = ?, comments_allowed = ?, offline_allowed = ?,
            email = ?, expires_at = ?, invited_by_user_id = ?, allowed = 1, revoked_at = NULL, updated_at = ?
        WHERE id = ? AND book_id = ? AND lower(email) = ?`,
      args: [
        passwordHash,
        invitation.grant_mode,
        invitation.comments_allowed,
        invitation.offline_allowed,
        invitation.email,
        invitation.grant_expires_at,
        invitation.created_by_user_id,
        now,
        grantId,
        invitation.book_id,
        invitation.email,
      ],
    });
  } else {
    statements.push({
      sql: `INSERT INTO book_access_grants
        (id, book_id, email, password_hash, mode, comments_allowed, offline_allowed,
         expires_at, invited_by_user_id, allowed, created_at, updated_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
      args: [
        grantId,
        invitation.book_id,
        invitation.email,
        passwordHash,
        invitation.grant_mode,
        invitation.comments_allowed,
        invitation.offline_allowed,
        invitation.grant_expires_at,
        invitation.created_by_user_id,
        now,
        now,
      ],
    });
  }

  if (invitation.role === 'creator') {
    statements.push({
      sql: `INSERT OR IGNORE INTO book_creators
        (id, book_id, user_id, assigned_by_user_id, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), invitation.book_id, userId, invitation.created_by_user_id, now],
    });
  }

  statements.push({
    sql: `UPDATE book_invitations
      SET status = 'accepted', user_id = ?, grant_id = ?, accepted_at = ?, updated_at = ?
      WHERE id = ? AND status = 'processing'`,
    args: [userId, grantId, now, now, invitation.id],
  });
  statements.push({
    sql: `UPDATE book_invitations
      SET status = 'revoked', revoked_at = ?, updated_at = ?
      WHERE book_id = ? AND lower(email) = ? AND id != ? AND status = 'pending'`,
    args: [now, now, invitation.book_id, invitation.email, invitation.id],
  });

  try {
    await transaction(env, statements);
  } catch (error) {
    await execute(
      env,
      `UPDATE book_invitations SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'processing'`,
      [new Date().toISOString(), invitation.id],
    );
    throw error;
  }

  const completed = await queryFirst<{ status: InvitationStatus }>(
    env,
    `SELECT status FROM book_invitations WHERE id = ? LIMIT 1`,
    [invitation.id],
  );
  if (completed?.status !== 'accepted') {
    await cleanupAcceptanceRace(env, invitation, userId, grantId);
    throw new AppError('The invitation changed; access was not activated', 'INVITATION_RACE', 409);
  }

  return {
    invitationId: invitation.id,
    userId,
    grantId,
    bookId: invitation.book_id,
    email: invitation.email,
    role: invitation.role,
  };
}
