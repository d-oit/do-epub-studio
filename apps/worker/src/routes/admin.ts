import type { Env } from '../lib/env';
import { execute, queryAll } from '../db/client';
import { createGrant } from '../auth/password';
import { jsonResponse } from '../lib/responses';

interface _BookRow {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  description: string | null;
  language: string;
  visibility: string;
  cover_image_url: string | null;
}

interface _GrantRow {
  id: string;
  book_id: string;
  email: string;
  mode: string;
  allowed: number;
  comments_allowed: number;
  offline_allowed: number;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export async function handleCreateBook(
  env: Env,
  body: {
    title: string;
    slug: string;
    authorName?: string;
    description?: string;
    language?: string;
    visibility?: string;
  },
  actorEmail?: string,
): Promise<Response> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO books (id, slug, title, author_name, description, language, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.slug.toLowerCase(),
      body.title,
      body.authorName ?? null,
      body.description ?? null,
      body.language ?? 'en',
      body.visibility ?? 'private',
      now,
      now,
    ],
  );

  await logAudit(env, {
    entityType: 'book',
    entityId: id,
    action: 'created',
    actorEmail,
    payload: { slug: body.slug, title: body.title },
  });

  return jsonResponse(
    {
      ok: true,
      data: { id, slug: body.slug, title: body.title },
    },
    201,
  );
}

export async function handleUploadComplete(
  env: Env,
  bookId: string,
  body: {
    storageKey: string;
    originalFilename: string;
    mimeType?: string;
    fileSizeBytes?: number;
    sha256?: string;
    epubVersion?: string;
  },
): Promise<Response> {
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, mime_type, file_size_bytes, sha256, epub_version, created_at)
     VALUES (?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileId,
      bookId,
      body.storageKey,
      body.originalFilename,
      body.mimeType ?? 'application/epub+zip',
      body.fileSizeBytes ?? 0,
      body.sha256 ?? null,
      body.epubVersion ?? null,
      now,
    ],
  );

  await logAudit(env, {
    entityType: 'book',
    entityId: bookId,
    action: 'file_uploaded',
    payload: { fileId, storageKey: body.storageKey },
  });

  return jsonResponse(
    {
      ok: true,
      data: { id: fileId, storageKey: body.storageKey },
    },
    201,
  );
}

export async function handleCreateAdminGrant(
  env: Env,
  bookId: string,
  body: {
    email: string;
    password?: string;
    mode?: string;
    commentsAllowed?: boolean;
    offlineAllowed?: boolean;
    expiresAt?: string;
  },
  actorEmail?: string,
): Promise<Response> {
  const grantId = await createGrant(env, bookId, body.email, {
    password: body.password,
    mode: body.mode,
    commentsAllowed: body.commentsAllowed,
    offlineAllowed: body.offlineAllowed,
    expiresAt: body.expiresAt,
  });

  await logAudit(env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'created',
    actorEmail,
    payload: { bookId, email: body.email, mode: body.mode },
  });

  return jsonResponse(
    {
      ok: true,
      data: { id: grantId, email: body.email },
    },
    201,
  );
}

export async function handleUpdateGrant(
  env: Env,
  grantId: string,
  body: {
    mode?: string;
    commentsAllowed?: boolean;
    offlineAllowed?: boolean;
    expiresAt?: string | null;
  },
  actorEmail?: string,
): Promise<Response> {
  const updates: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [new Date().toISOString()];

  if (body.mode !== undefined) {
    updates.push('mode = ?');
    args.push(body.mode);
  }
  if (body.commentsAllowed !== undefined) {
    updates.push('comments_allowed = ?');
    args.push(body.commentsAllowed ? 1 : 0);
  }
  if (body.offlineAllowed !== undefined) {
    updates.push('offline_allowed = ?');
    args.push(body.offlineAllowed ? 1 : 0);
  }
  if (body.expiresAt !== undefined) {
    updates.push('expires_at = ?');
    args.push(body.expiresAt);
  }

  args.push(grantId);

  await execute(env, `UPDATE book_access_grants SET ${updates.join(', ')} WHERE id = ?`, args);

  await logAudit(env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'updated',
    actorEmail,
    payload: body,
  });

  return jsonResponse({ ok: true, data: { id: grantId, ...body } });
}

export async function handleRevokeGrant(
  env: Env,
  grantId: string,
  actorEmail?: string,
): Promise<Response> {
  await execute(env, `UPDATE book_access_grants SET revoked_at = datetime('now') WHERE id = ?`, [
    grantId,
  ]);

  await execute(
    env,
    `UPDATE reader_sessions SET revoked_at = datetime('now') 
     WHERE book_id = (SELECT book_id FROM book_access_grants WHERE id = ?)
     AND email = (SELECT email FROM book_access_grants WHERE id = ?)`,
    [grantId, grantId],
  );

  await logAudit(env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'revoked',
    actorEmail,
  });

  return jsonResponse({ ok: true });
}

export async function handleGetBookGrants(env: Env, bookId: string): Promise<Response> {
  const grants = (await queryAll(
    env,
    `SELECT * FROM book_access_grants WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId],
  )) as unknown as _GrantRow[];

  return jsonResponse({
    ok: true,
    data: grants.map((g) => ({
      id: g.id,
      email: g.email,
      mode: g.mode,
      commentsAllowed: g.comments_allowed === 1,
      offlineAllowed: g.offline_allowed === 1,
      expiresAt: g.expires_at,
      createdAt: g.created_at,
      revokedAt: g.revoked_at,
    })),
  });
}

export async function handleGetAuditLog(
  env: Env,
  entityType?: string,
  entityId?: string,
  limit = 100,
): Promise<Response> {
  await logAudit(env, {
    entityType: entityType as
      | 'book'
      | 'grant'
      | 'session'
      | 'comment'
      | 'user'
      | 'bookmark'
      | 'highlight',
    entityId: entityId ?? '',
    action: 'query',
  });

  const rows = await queryAll(
    env,
    `SELECT * FROM audit_log WHERE (? IS NULL OR entity_type = ?) AND (? IS NULL OR entity_id = ?) ORDER BY created_at DESC LIMIT ?`,
    [entityType ?? null, entityType ?? null, entityId ?? null, entityId ?? null, limit],
  );

  return jsonResponse({
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      payload: row.payload_json ? JSON.parse(row.payload_json as string) : null,
      createdAt: row.created_at,
    })),
  });
}

async function logAudit(
  env: Env,
  entry: {
    entityType: 'book' | 'grant' | 'session' | 'comment' | 'user' | 'bookmark' | 'highlight';
    entityId: string;
    action: string;
    actorEmail?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  const payloadJson = entry.payload ? JSON.stringify(entry.payload) : null;

  await execute(
    env,
    `INSERT INTO audit_log (id, actor_email, entity_type, entity_id, action, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entry.actorEmail ?? null, entry.entityType, entry.entityId, entry.action, payloadJson],
  );
}
