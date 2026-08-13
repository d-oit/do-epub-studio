import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../../lib/env';
import { queryAll, transaction } from '../../db/client';
import { createGrant } from '../../auth/password';
import { logAudit } from '../../audit';
import { CreateGrantSchema, UpdateGrantSchema } from '@do-epub-studio/shared';
import { GrantsListQuerySchema } from '@do-epub-studio/schema';
import { adminAuth } from '../../middleware/auth';
import { requireStepUp } from '../../middleware/step-up';

export const grantsRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

interface GrantRow {
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

// ADR-234 sensitive-action "grant issuance": granting a new reader access.
grantsRouter.post('/books/:id/grants', adminAuth, requireStepUp, zValidator('json', CreateGrantSchema), async (c) => {
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
  }, c.executionCtx);

  return c.json({ ok: true, data: { id: grantId, email: body.email } }, 201);
});

grantsRouter.get('/books/:id/grants', adminAuth, zValidator('query', GrantsListQuerySchema), async (c) => {
  const bookId = c.req.param('id');
  const { limit, offset } = c.req.valid('query');
  const grants = (await queryAll(
    c.env,
    `SELECT id, book_id, email, mode, allowed, comments_allowed, offline_allowed, expires_at, created_at, revoked_at FROM book_access_grants WHERE book_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [bookId, limit, offset],
  )) as unknown as GrantRow[];

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

// ADR-234 sensitive-action "grant modification": privilege/expiry change +
// immediate reader-session revocation.
grantsRouter.patch('/grants/:id', adminAuth, requireStepUp, zValidator('json', UpdateGrantSchema), async (c) => {
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

  // AGENTS.md TIER-1: revoke sessions immediately on grant change.
  // A downgraded grant (mode/comments/offline/expiry tightened) must not
  // leave elevated sessions live. We revoke in the same transaction so
  // the UPDATE and the session-revocation are atomic.
  await transaction(c.env, [
    { sql: `UPDATE book_access_grants SET ${updates.join(', ')} WHERE id = ?`, args },
    {
      sql: `UPDATE reader_sessions SET revoked_at = datetime('now')
     WHERE book_id = (SELECT book_id FROM book_access_grants WHERE id = ?)
     AND email = (SELECT email FROM book_access_grants WHERE id = ?)
     AND revoked_at IS NULL`,
      args: [grantId, grantId],
    },
  ]);

  await logAudit(c.env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'updated',
    actorEmail: adminUser.email,
    payload: { ...body, sessionsRevoked: true },
  }, c.executionCtx);

  return c.json({ ok: true, data: { id: grantId, ...body, sessionsRevoked: true } });
});

// ADR-234 sensitive-action "grant revocation" (incl. bulk revoke via
// repeated calls): revokes an access grant and all attached reader sessions.
grantsRouter.post('/grants/:id/revoke', adminAuth, requireStepUp, async (c) => {
  const grantId = c.req.param('id');
  const adminUser = c.get('adminUser');

  await transaction(c.env, [
    { sql: `UPDATE book_access_grants SET revoked_at = datetime('now') WHERE id = ?`, args: [grantId] },
    {
      sql: `UPDATE reader_sessions SET revoked_at = datetime('now')
     WHERE book_id = (SELECT book_id FROM book_access_grants WHERE id = ?)
     AND email = (SELECT email FROM book_access_grants WHERE id = ?)`,
      args: [grantId, grantId],
    },
  ]);

  await logAudit(c.env, {
    entityType: 'grant',
    entityId: grantId,
    action: 'revoked',
    actorEmail: adminUser.email,
  }, c.executionCtx);

  return c.json({ ok: true });
});
