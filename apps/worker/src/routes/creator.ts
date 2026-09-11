import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import {
  FeedbackReplySchema,
  FeedbackDispositionSchema,
  FeedbackExportSchema,
  FeedbackListQuerySchema,
} from '@do-epub-studio/schema';
import { assertBookAccess } from '../lib/tenant-isolation';
import { getRequestTraceId } from '../lib/api-error';
import { readerAuth } from '../middleware/auth';
import { NotFoundError, ForbiddenError, AppError } from '../lib/http-errors';
import type { JsonRow } from '../lib/env';

export const creatorRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface CreatorBookRow extends JsonRow {
  id: string;
  slug: string;
  title: string;
}

interface FeedbackRow extends JsonRow {
  [key: string]: string | number | null | undefined;
  id: string;
  book_id: string;
  book_file_id: string | null;
  source_sha256: string | null;
  chapter_ref: string | null;
  cfi: string | null;
  selected_text: string | null;
  prefix: string | null;
  suffix: string | null;
  kind: string;
  category: string;
  body: string;
  proposed_text: string | null;
  submitter_email: string;
  status: string;
  mutation_id: string;
  created_at: string;
  updated_at: string;
}

interface ReplyRow extends JsonRow {
  id: string;
  author_email: string;
  author_role: string;
  body: string;
  created_at: string;
}

interface EventRow extends JsonRow {
  actor_email: string;
  event: string;
  created_at: string;
}

/**
 * Book-scoped creator gate: valid session + current assignment row for this
 * book. Identity resolves server-side (session email → users.id); a
 * client-supplied creator id is never trusted.
 */
async function requireCreator(
  env: Env,
  auth: AuthContext,
  bookId: string,
): Promise<{ userId: string }> {
  const row = await queryFirst<{ id: string }>(
    env,
    `SELECT bc.id AS id FROM book_creators bc
     JOIN users u ON u.id = bc.user_id
     WHERE bc.book_id = ? AND u.email = ?`,
    [bookId, auth.email],
  );
  if (!row) {
    throw new ForbiddenError('Access denied');
  }
  const user = await queryFirst<{ id: string }>(
    env,
    `SELECT id FROM users WHERE email = ?`,
    [auth.email],
  );
  if (!user) {
    throw new ForbiddenError('Access denied');
  }
  return { userId: user.id };
}

function toCreatorDTO(
  row: FeedbackRow,
  replies: ReplyRow[] = [],
  events: EventRow[] = [],
  replyCount = 0,
): Record<string, unknown> {
  const email = row.submitter_email;
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    body: row.body,
    proposedText: row.proposed_text,
    anchor: {
      bookFileId: row.book_file_id,
      sourceSha256: row.source_sha256,
      chapterRef: row.chapter_ref,
      cfi: row.cfi,
      selectedText: row.selected_text,
      prefix: row.prefix,
      suffix: row.suffix,
    },
    status: row.status,
    submitterEmail: email,
    displayName: email.slice(0, 2) + '***',
    replyCount,
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorRole: r.author_role,
      authorEmail: r.author_email,
      createdAt: r.created_at,
    })),
    events: events.map((e) => ({
      actorEmail: e.actor_email,
      event: e.event,
      createdAt: e.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replyCountFor(env: Env, feedbackId: string): Promise<number> {
  const row = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) AS n FROM feedback_replies WHERE feedback_id = ?`,
    [feedbackId],
  );
  return row?.n ?? 0;
}

async function threadFor(env: Env, feedbackId: string): Promise<{ replies: ReplyRow[]; events: EventRow[] }> {
  const replies = await queryAll<ReplyRow>(
    env,
    `SELECT * FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC LIMIT 500`,
    [feedbackId],
  );
  const events = await queryAll<EventRow>(
    env,
    `SELECT actor_email, event, created_at FROM feedback_events WHERE feedback_id = ? ORDER BY created_at ASC LIMIT 500`,
    [feedbackId],
  );
  return { replies, events };
}

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  // Suggestion lifecycle
  'open|suggestion': ['accepted', 'declined'],
  // Comment lifecycle
  'open|comment': ['resolved'],
  // Reopen paths (withdrawn is terminal)
  'accepted|suggestion': ['open'],
  'declined|suggestion': ['open'],
  'resolved|comment': ['open'],
};

creatorRouter.get('/creator/books', readerAuth, async (c) => {
  const auth = c.get('auth');

  const books = await queryAll<CreatorBookRow>(
    c.env,
    `SELECT b.id AS id, b.slug AS slug, b.title AS title
     FROM books b
     JOIN book_creators bc ON bc.book_id = b.id
     JOIN users u ON u.id = bc.user_id
     WHERE u.email = ?
     ORDER BY b.title ASC LIMIT 200`,
    [auth.email],
  );

  return c.json({ ok: true, data: books });
});

creatorRouter.get(
  '/creator/books/:bookId/feedback',
  readerAuth,
  zValidator('query', FeedbackListQuerySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const { status, category, limit, offset } = c.req.valid('query');
    const args: (string | number)[] = [bookId];
    let sql = `SELECT * FROM editorial_feedback WHERE book_id = ?`;
    if (status) {
      sql += ` AND status = ?`;
      args.push(status);
    }
    if (category) {
      sql += ` AND category = ?`;
      args.push(category);
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const rows = await queryAll<FeedbackRow>(c.env, sql, args);
    const data = await Promise.all(
      rows.map(async (row) => toCreatorDTO(row, [], [], await replyCountFor(c.env, row.id))),
    );

    return c.json({ ok: true, data });
  },
);

creatorRouter.get('/creator/books/:bookId/feedback/:id', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const id = c.req.param('id');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
  if (mismatch) return mismatch.response;
  await requireCreator(c.env, auth, bookId);

  const row = await queryFirst<FeedbackRow>(
    c.env,
    `SELECT * FROM editorial_feedback WHERE id = ? AND book_id = ?`,
    [id, bookId],
  );
  if (!row) {
    throw new NotFoundError('Feedback');
  }
  const { replies, events } = await threadFor(c.env, id);
  return c.json({ ok: true, data: toCreatorDTO(row, replies, events) });
});

creatorRouter.post(
  '/creator/books/:bookId/feedback/:id/replies',
  readerAuth,
  zValidator('json', FeedbackReplySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const row = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    if (!row) {
      throw new NotFoundError('Feedback');
    }
    if (row.status === 'withdrawn') {
      throw new AppError('Feedback is withdrawn', 'FEEDBACK_WITHDRAWN', 422);
    }

    const body = c.req.valid('json');
    const now = new Date().toISOString();

    await execute(
      c.env,
      `INSERT INTO feedback_replies (id, feedback_id, author_email, author_role, body, created_at)
       VALUES (?, ?, ?, 'creator', ?, ?)`,
      [crypto.randomUUID(), id, auth.email, body.body, now],
    );
    await execute(
      c.env,
      `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
       VALUES (?, ?, ?, 'replied', ?)`,
      [crypto.randomUUID(), id, auth.email, now],
    );
    await logAudit(c.env, {
      entityType: 'editorial-feedback',
      entityId: id,
      action: 'creator-reply',
      actorEmail: auth.email,
      payload: { bookId },
    }, c.executionCtx);

    const { replies, events } = await threadFor(c.env, id);
    const updated = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE id = ?`,
      [id],
    );
    if (!updated) {
      throw new NotFoundError('Feedback');
    }
    return c.json({ ok: true, data: toCreatorDTO(updated, replies, events) }, 201);
  },
);

creatorRouter.post(
  '/creator/books/:bookId/feedback/:id/disposition',
  readerAuth,
  zValidator('json', z.object({ disposition: FeedbackDispositionSchema })),
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const row = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    if (!row) {
      throw new NotFoundError('Feedback');
    }

    const body = c.req.valid('json');
    const allowed = LEGAL_TRANSITIONS[`${row.status}|${row.kind}`] ?? [];
    if (!allowed.includes(body.disposition)) {
      throw new AppError(
        `Illegal disposition ${body.disposition} for ${row.kind} in status ${row.status}`,
        'ILLEGAL_DISPOSITION',
        422,
      );
    }

    const now = new Date().toISOString();
    const event = body.disposition === 'open' ? 'reopened' : body.disposition;

    await execute(
      c.env,
      `UPDATE editorial_feedback SET status = ?, updated_at = ? WHERE id = ?`,
      [body.disposition, now, id],
    );
    await execute(
      c.env,
      `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, auth.email, event, now],
    );
    await logAudit(c.env, {
      entityType: 'editorial-feedback',
      entityId: id,
      action: `disposition-${event}`,
      actorEmail: auth.email,
      payload: { bookId, from: row.status, to: body.disposition },
    }, c.executionCtx);

    // `accepted` records editorial agreement only — it never modifies files.
    const { replies, events } = await threadFor(c.env, id);
    const updated = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE id = ?`,
      [id],
    );
    if (!updated) {
      throw new NotFoundError('Feedback');
    }
    return c.json({ ok: true, data: toCreatorDTO(updated, replies, events) });
  },
);

creatorRouter.post(
  '/creator/books/:bookId/export',
  readerAuth,
  zValidator('json', FeedbackExportSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const body = c.req.valid('json');
    const now = new Date().toISOString();

    const items = [];
    for (const id of body.ids) {
      const row = await queryFirst<FeedbackRow>(
        c.env,
        `SELECT * FROM editorial_feedback WHERE id = ? AND book_id = ?`,
        [id, bookId],
      );
      if (!row) continue;
      const { replies, events } = await threadFor(c.env, id);
      items.push(toCreatorDTO(row, replies, events));
      await execute(
        c.env,
        `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
         VALUES (?, ?, ?, 'exported', ?)`,
        [crypto.randomUUID(), id, auth.email, now],
      );
    }

    await logAudit(c.env, {
      entityType: 'editorial-feedback-export',
      entityId: bookId,
      action: 'export',
      actorEmail: auth.email,
      payload: { bookId, count: items.length },
    }, c.executionCtx);

    return c.json({ ok: true, data: { items } });
  },
);
