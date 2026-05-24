import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { execute, queryAll, queryFirst } from '../db/client';
import { createGrant } from '../auth/password';
import { logAudit } from '../audit';
import {
  CreateBookSchema,
  CreateGrantSchema,
  UpdateGrantSchema,
} from '@do-epub-studio/shared';
import { z } from 'zod';
import { requireAdminAuth, createAdminSession, revokeAdminSession } from '../auth/admin-middleware';
import { checkRateLimitDO } from '../lib/rate-limit-client';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { MiddlewareHandler } from 'hono';

export const adminRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UploadCompleteSchema = z.object({
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  sha256: z.string().max(64).optional(),
  epubVersion: z.string().max(10).optional(),
});

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

// Public Routes
adminRouter.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const rateLimit = await checkRateLimitDO(c.env, 'auth_admin', email.toLowerCase(), {
    maxRequests: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return c.json(
      {
        ok: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
      },
      429,
    );
  }

  const result = await createAdminSession(c.env, email, password);

  if (!result.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_CREDENTIALS', message: result.error } },
      result.status as ContentfulStatusCode,
    );
  }

  await logAudit(c.env, {
    entityType: 'user',
    entityId: result.user.id,
    action: 'admin_login',
    actorEmail: result.user.email,
    payload: { role: result.user.role },
  });

  return c.json({
    ok: true,
    data: {
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    },
  });
});

adminRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (!token) {
    return c.json(
      { ok: false, error: { code: 'MISSING_TOKEN', message: 'Authorization token required' } },
      400,
    );
  }

  await revokeAdminSession(c.env, token);

  return c.json({ ok: true });
});

// Admin Authentication Middleware
const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }> = async (c, next) => {
  const authResult = await requireAdminAuth(c.env, c.req.raw);
  if (!authResult || !authResult.ok) {
    const status = (authResult && 'status' in authResult ? authResult.status : 401) as ContentfulStatusCode;
    const message = (authResult && 'error' in authResult ? authResult.error : 'Unauthorized');
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message } }, status);
  }
  c.set('adminUser', {
    id: authResult.context.userId,
    email: authResult.context.email,
    role: authResult.context.globalRole
  });
  await next();
};

adminRouter.post('/books', authMiddleware, zValidator('json', CreateBookSchema), async (c) => {
  const body = c.req.valid('json');
  const adminUser = c.get('adminUser');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
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

  let baseUrl = c.env.APP_BASE_URL;
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const uploadUrl = `${baseUrl}/api/admin/books/${id}/upload`;

  await logAudit(c.env, {
    entityType: 'book',
    entityId: id,
    action: 'created',
    actorEmail: adminUser.email,
    payload: { slug: body.slug, title: body.title },
  });

  return c.json(
    {
      ok: true,
      data: { id, slug: body.slug, title: body.title, uploadUrl },
    },
    201,
  );
});

adminRouter.put('/books/:id/upload', authMiddleware, async (c) => {
  const bookId = c.req.param('id');

  const book = await queryFirst<{ id: string; slug: string }>(
    c.env,
    `SELECT id, slug FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`,
    [bookId],
  );

  if (!book) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
  }

  const contentType = c.req.header('Content-Type') ?? 'application/epub+zip';
  const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);

  if (contentLength <= 0) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Missing Content-Length header' } }, 400);
  }

  const maxFileSize = 200 * 1024 * 1024;
  if (contentLength > maxFileSize) {
    return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: `File too large. Max: ${maxFileSize} bytes` } }, 413);
  }

  const storageKey = `books/${book.id}/${crypto.randomUUID()}.epub`;

  try {
    const body = c.req.raw.body;
    if (!body) {
      return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body is empty' } }, 400);
    }

    await c.env.BOOKS_BUCKET.put(storageKey, body, {
      httpMetadata: {
        contentType,
        contentDisposition: `attachment; filename="${book.slug}.epub"`,
      },
      customMetadata: {
        bookId: book.id,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch {
    return c.json({ ok: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file to storage' } }, 500);
  }

  return c.json({ ok: true, data: { storageKey, bookId: book.id, slug: book.slug } }, 200);
});

adminRouter.post('/books/:id/upload-complete', authMiddleware, zValidator('json', UploadCompleteSchema), async (c) => {
  const bookId = c.req.param('id');
  const body = c.req.valid('json');
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    c.env,
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

  await logAudit(c.env, {
    entityType: 'book',
    entityId: bookId,
    action: 'file_uploaded',
    payload: { fileId, storageKey: body.storageKey },
  });

  return c.json({ ok: true, data: { id: fileId, storageKey: body.storageKey } }, 201);
});

adminRouter.post('/books/:id/grants', authMiddleware, zValidator('json', CreateGrantSchema), async (c) => {
  const bookId = c.req.param('id');
  const body = c.req.valid('json');
  const adminUser = c.get('adminUser');

  const grantId = await createGrant(c.env, bookId, body.email, {
    password: body.password,
    mode: body.mode,
    commentsAllowed: body.commentsAllowed,
    offlineAllowed: body.offlineAllowed,
    expiresAt: body.expiresAt,
  });

  await logAudit(c.env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'created',
    actorEmail: adminUser.email,
    payload: { bookId, email: body.email, mode: body.mode },
  });

  return c.json({ ok: true, data: { id: grantId, email: body.email } }, 201);
});

adminRouter.get('/books/:id/grants', authMiddleware, async (c) => {
  const bookId = c.req.param('id');
  const grants = (await queryAll(
    c.env,
    `SELECT * FROM book_access_grants WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId],
  )) as unknown as _GrantRow[];

  return c.json({
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
});

adminRouter.patch('/grants/:id', authMiddleware, zValidator('json', UpdateGrantSchema), async (c) => {
  const grantId = c.req.param('id');
  const body = c.req.valid('json');
  const adminUser = c.get('adminUser');

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

  await execute(c.env, `UPDATE book_access_grants SET ${updates.join(', ')} WHERE id = ?`, args);

  await logAudit(c.env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'updated',
    actorEmail: adminUser.email,
    payload: body,
  });

  return c.json({ ok: true, data: { id: grantId, ...body } });
});

adminRouter.post('/grants/:id/revoke', authMiddleware, async (c) => {
  const grantId = c.req.param('id');
  const adminUser = c.get('adminUser');

  await execute(c.env, `UPDATE book_access_grants SET revoked_at = datetime('now') WHERE id = ?`, [
    grantId,
  ]);

  await execute(
    c.env,
    `UPDATE reader_sessions SET revoked_at = datetime('now') 
     WHERE book_id = (SELECT book_id FROM book_access_grants WHERE id = ?)
     AND email = (SELECT email FROM book_access_grants WHERE id = ?)`,
    [grantId, grantId],
  );

  await logAudit(c.env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'revoked',
    actorEmail: adminUser.email,
  });

  return c.json({ ok: true });
});

adminRouter.get('/audit', authMiddleware, async (c) => {
  const entityType = c.req.query('entityType') as "book" | "user" | "grant" | "reader_session" | "comment" | undefined;
  const entityId = c.req.query('entityId');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const from = c.req.query('from');
  const to = c.req.query('to');

  await logAudit(c.env, {
    entityType: entityType ?? 'user', // default to user for query logging if undefined
    entityId: entityId ?? '',
    action: 'query',
  });

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    args.push(entityType);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    args.push(entityId);
  }
  if (from) {
    conditions.push('created_at >= ?');
    args.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    args.push(to);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryAll<{ cnt: number }>(
    c.env,
    `SELECT COUNT(*) as cnt FROM audit_log${whereClause}`,
    args,
  );
  const total = countResult[0]?.cnt ?? 0;

  const rows = await queryAll(
    c.env,
    `SELECT * FROM audit_log${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );

  return c.json({
    ok: true,
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        payload: row.payload_json ? (JSON.parse(row.payload_json as string) as Record<string, unknown>) : null,
        createdAt: row.created_at,
      })),
      total,
    },
  });
});

adminRouter.get('/audit-logs', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/audit-logs', '/audit');
  return c.redirect(url.toString(), 301);
});
