import type { Env, JsonRow } from '../lib/env';
import { execute, queryAll, queryFirst, transaction } from '../db/client';
import { hashToken } from './session';
import { AppError, NotFoundError } from '../lib/http-errors';
import type {
  CreateBookInvitation,
  InvitationDeliveryStatus,
  InvitationRole,
  InvitationStatus,
} from '@do-epub-studio/schema';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITATION_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const INVITATION_TOKEN_BYTES = 32;

export interface InvitationRow extends JsonRow {
  id: string;
  book_id: string;
  email: string;
  role: InvitationRole;
  token_hash?: string;
  status: InvitationStatus;
  delivery_status: InvitationDeliveryStatus;
  delivery_attempted_at: string | null;
  delivery_error_code: string | null;
  user_id: string | null;
  grant_id: string | null;
  grant_mode: string;
  comments_allowed: number;
  offline_allowed: number;
  grant_expires_at: string | null;
  expires_at: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface InvitationBookRow extends InvitationRow {
  book_slug: string;
  book_title: string;
  book_author_name: string | null;
  book_cover_image_url: string | null;
  book_visibility: string;
  book_archived_at: string | null;
}

export interface InvitationDto {
  id: string;
  bookId: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  deliveryStatus: InvitationDeliveryStatus;
  deliveryErrorCode: string | null;
  grantMode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  grantExpiresAt: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedInvitation {
  invitation: InvitationDto;
  rawToken: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function processingIsStale(row: Pick<InvitationRow, 'status' | 'updated_at'>): boolean {
  return (
    row.status === 'processing' &&
    Date.now() - new Date(row.updated_at).getTime() > INVITATION_PROCESSING_TIMEOUT_MS
  );
}

function generateInvitationToken(): string {
  const bytes = new Uint8Array(INVITATION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function invitationSelect(): string {
  return `SELECT bi.id, bi.book_id, bi.email, bi.role, bi.status,
    bi.delivery_status, bi.delivery_attempted_at, bi.delivery_error_code,
    bi.user_id, bi.grant_id, bi.grant_mode, bi.comments_allowed,
    bi.offline_allowed, bi.grant_expires_at, bi.expires_at,
    bi.created_by_user_id, bi.created_at, bi.updated_at, bi.accepted_at,
    bi.revoked_at, b.slug AS book_slug, b.title AS book_title,
    b.author_name AS book_author_name, b.cover_image_url AS book_cover_image_url,
    b.visibility AS book_visibility, b.archived_at AS book_archived_at
    FROM book_invitations bi
    JOIN books b ON b.id = bi.book_id`;
}

function toInvitationDto(row: InvitationRow): InvitationDto {
  const status =
    row.status === 'pending' && new Date(row.expires_at) <= new Date() ? 'expired' : row.status;
  return {
    id: row.id,
    bookId: row.book_id,
    email: row.email,
    role: row.role,
    status,
    deliveryStatus: row.delivery_status,
    deliveryErrorCode: row.delivery_error_code,
    grantMode: row.grant_mode,
    commentsAllowed: row.comments_allowed === 1,
    offlineAllowed: row.offline_allowed === 1,
    grantExpiresAt: row.grant_expires_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  };
}

export async function grantForBookEmail(
  env: Env,
  bookId: string,
  email: string,
): Promise<{ id: string; allowed: number; revoked_at: string | null } | null> {
  return queryFirst(
    env,
    `SELECT id, allowed, revoked_at
     FROM book_access_grants
     WHERE book_id = ? AND lower(email) = ?
     LIMIT 1`,
    [bookId, email],
  );
}

export async function pendingUser(
  env: Env,
  email: string,
): Promise<{ id: string; disabled_at: string | null; compromised_at: string | null } | null> {
  return queryFirst(
    env,
    `SELECT id, disabled_at, compromised_at FROM users WHERE lower(email) = ? LIMIT 1`,
    [email],
  );
}

export async function createBookInvitation(
  env: Env,
  input: CreateBookInvitation,
  createdByUserId: string,
): Promise<CreatedInvitation> {
  const email = normalizeEmail(input.email);
  const book = await queryFirst<{ id: string }>(
    env,
    `SELECT id FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`,
    [input.bookId],
  );
  if (!book) throw new NotFoundError('Book');
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
    throw new AppError('Grant expiry must be in the future', 'INVALID_GRANT_EXPIRY', 400);
  }

  const grant = await grantForBookEmail(env, input.bookId, email);
  if (grant && grant.allowed === 1 && !grant.revoked_at) {
    throw new AppError(
      'This email already has active access to this book',
      'INVITATION_CONFLICT',
      409,
    );
  }

  const user = await pendingUser(env, email);
  if (user && (user.disabled_at || user.compromised_at)) {
    throw new AppError('The account is unavailable', 'ACCOUNT_UNAVAILABLE', 409);
  }

  const rawToken = generateInvitationToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS).toISOString();
  const id = crypto.randomUUID();
  const pending = await queryFirst<{ id: string; status: InvitationStatus; updated_at: string }>(
    env,
    `SELECT id, status, updated_at FROM book_invitations
     WHERE book_id = ? AND lower(email) = ? AND status IN ('pending', 'processing') LIMIT 1`,
    [input.bookId, email],
  );
  if (pending && pending.status === 'processing' && !processingIsStale(pending)) {
    throw new AppError(
      'An invitation for this email is still processing',
      'INVITATION_PROCESSING',
      409,
    );
  }

  const statements = [];
  if (pending) {
    statements.push({
      sql: `UPDATE book_invitations
        SET status = 'revoked', revoked_at = ?, updated_at = ?
        WHERE id = ? AND (status = 'pending' OR (status = 'processing' AND updated_at < ?))`,
      args: [
        now.toISOString(),
        now.toISOString(),
        pending.id,
        new Date(Date.now() - INVITATION_PROCESSING_TIMEOUT_MS).toISOString(),
      ],
    });
  }
  statements.push({
    sql: `INSERT INTO book_invitations
      (id, book_id, email, role, token_hash, status, delivery_status,
       grant_mode, comments_allowed, offline_allowed, grant_expires_at,
       expires_at, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.bookId,
      email,
      input.role,
      tokenHash,
      input.mode,
      input.commentsAllowed ? 1 : 0,
      input.offlineAllowed ? 1 : 0,
      input.expiresAt ?? null,
      expiresAt,
      createdByUserId,
      now.toISOString(),
      now.toISOString(),
    ],
  });
  await transaction(env, statements);

  return {
    rawToken,
    invitation: {
      id,
      bookId: input.bookId,
      email,
      role: input.role,
      status: 'pending',
      deliveryStatus: 'pending',
      deliveryErrorCode: null,
      grantMode: input.mode,
      commentsAllowed: input.commentsAllowed,
      offlineAllowed: input.offlineAllowed,
      grantExpiresAt: input.expiresAt ?? null,
      expiresAt,
      createdAt: now.toISOString(),
      acceptedAt: null,
      revokedAt: null,
    },
  };
}

export async function listBookInvitations(
  env: Env,
  bookId: string,
  limit: number,
  offset: number,
): Promise<InvitationDto[]> {
  const rows = await queryAll<InvitationRow>(
    env,
    `${invitationSelect()}
     WHERE bi.book_id = ?
     ORDER BY bi.created_at DESC
     LIMIT ? OFFSET ?`,
    [bookId, limit, offset],
  );
  return rows.map(toInvitationDto);
}

export async function findInvitation(
  env: Env,
  bookId: string,
  invitationId: string,
): Promise<InvitationBookRow | null> {
  return queryFirst<InvitationBookRow>(
    env,
    `${invitationSelect()} WHERE bi.book_id = ? AND bi.id = ? LIMIT 1`,
    [bookId, invitationId],
  );
}

export async function resendBookInvitation(
  env: Env,
  bookId: string,
  invitationId: string,
): Promise<CreatedInvitation> {
  const current = await findInvitation(env, bookId, invitationId);
  if (!current) throw new NotFoundError('Invitation');
  const canResend =
    current.status === 'pending' ||
    current.status === 'failed' ||
    current.status === 'expired' ||
    processingIsStale(current);
  if (!canResend) {
    throw new AppError('Only pending invitations can be resent', 'INVITATION_NOT_PENDING', 409);
  }

  const rawToken = generateInvitationToken();
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS).toISOString();
  const processingCutoff = new Date(Date.now() - INVITATION_PROCESSING_TIMEOUT_MS).toISOString();
  const statusClause = processingIsStale(current)
    ? "status = 'processing' AND updated_at < ?"
    : 'status = ?';
  const statusArgs = processingIsStale(current) ? [processingCutoff] : [current.status];
  const result = await env.DB.prepare(
    `UPDATE book_invitations
     SET token_hash = ?, status = 'pending', delivery_status = 'pending',
         delivery_attempted_at = NULL, delivery_error_code = NULL,
         expires_at = ?, updated_at = ?
     WHERE id = ? AND ${statusClause}`,
  )
    .bind(tokenHash, expiresAt, now.toISOString(), invitationId, ...statusArgs)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    throw new AppError('The invitation changed; reload and try again', 'INVITATION_RACE', 409);
  }

  return {
    rawToken,
    invitation: toInvitationDto({
      ...current,
      token_hash: tokenHash,
      status: 'pending',
      delivery_status: 'pending',
      delivery_error_code: null,
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    }),
  };
}

export async function revokeBookInvitation(
  env: Env,
  bookId: string,
  invitationId: string,
): Promise<void> {
  const current = await findInvitation(env, bookId, invitationId);
  if (!current) throw new NotFoundError('Invitation');

  const now = new Date().toISOString();
  if (current.status !== 'revoked') {
    const result = await env.DB.prepare(
      `UPDATE book_invitations
       SET status = 'revoked', revoked_at = ?, updated_at = ?
       WHERE id = ? AND (
         status IN ('pending', 'accepted', 'failed', 'expired') OR
         (status = 'processing' AND updated_at < ?)
       )`,
    )
      .bind(
        now,
        now,
        invitationId,
        new Date(Date.now() - INVITATION_PROCESSING_TIMEOUT_MS).toISOString(),
      )
      .run();
    if ((result.meta?.changes ?? 0) === 0) {
      throw new AppError('The invitation changed; reload and try again', 'INVITATION_RACE', 409);
    }
  }

  if (current.grant_id) {
    const statements = [
      {
        sql: `UPDATE book_access_grants
          SET allowed = 0, revoked_at = ?, updated_at = ?
          WHERE id = ? AND book_id = ?`,
        args: [now, now, current.grant_id, bookId],
      },
      {
        sql: `UPDATE reader_sessions
          SET revoked_at = ?
          WHERE book_id = ? AND lower(email) = ? AND revoked_at IS NULL`,
        args: [now, bookId, current.email],
      },
    ];
    if (current.role === 'creator' && current.user_id) {
      statements.push({
        sql: `DELETE FROM book_creators WHERE book_id = ? AND user_id = ?`,
        args: [bookId, current.user_id],
      });
    }
    await transaction(env, statements);
  }
}

export async function setInvitationDeliveryStatus(
  env: Env,
  invitationId: string,
  status: InvitationDeliveryStatus,
  errorCode: string | null = null,
): Promise<void> {
  await execute(
    env,
    `UPDATE book_invitations
     SET delivery_status = ?, delivery_attempted_at = ?, delivery_error_code = ?, updated_at = ?
     WHERE id = ?`,
    [status, new Date().toISOString(), errorCode, new Date().toISOString(), invitationId],
  );
}

export async function claimInvitation(env: Env, invitationId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE book_invitations
     SET status = 'processing', updated_at = ?
     WHERE id = ? AND status = 'pending' AND expires_at > ?`,
  )
    .bind(now, invitationId, now)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
