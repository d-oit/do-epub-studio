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
  ReferenceCreateSchema,
  ReferenceUpdateSchema,
  ReferenceVerifySchema,
  ReferenceListQuerySchema,
  StyleProfileSchema,
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

// ── Wave 3 (COL-03): references & style profile ─────────────────────────

interface ReferenceRow extends JsonRow {
  id: string;
  book_id: string;
  kind: string;
  title: string | null;
  content: string;
  attribution: string | null;
  source_url: string | null;
  origin: string;
  verified: number;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function toReferenceDTO(row: ReferenceRow): Record<string, unknown> {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    attribution: row.attribution,
    sourceUrl: row.source_url,
    origin: row.origin,
    verified: row.verified === 1,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

creatorRouter.get(
  '/creator/books/:bookId/references',
  readerAuth,
  zValidator('query', ReferenceListQuerySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const { kind, limit, offset } = c.req.valid('query');
    const args: (string | number)[] = [bookId];
    let sql = `SELECT * FROM book_references WHERE book_id = ?`;
    if (kind) {
      sql += ` AND kind = ?`;
      args.push(kind);
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const rows = await queryAll<ReferenceRow>(c.env, sql, args);
    return c.json({ ok: true, data: rows.map(toReferenceDTO) });
  },
);

creatorRouter.post(
  '/creator/books/:bookId/references',
  readerAuth,
  zValidator('json', ReferenceCreateSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const body = c.req.valid('json');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // External citations are born unverified; book/creator origins are
    // creator-curated by definition and start verified.
    const verified = body.origin === 'external' ? 0 : 1;

    await execute(
      c.env,
      `INSERT INTO book_references
        (id, book_id, kind, title, content, attribution, source_url, origin, verified, revision, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        bookId,
        body.kind,
        body.title ?? null,
        body.content,
        auth.email,
        body.sourceUrl ?? null,
        body.origin,
        verified,
        auth.email,
        now,
        now,
      ],
    );

    await logAudit(c.env, {
      entityType: 'book-reference',
      entityId: id,
      action: 'created',
      actorEmail: auth.email,
      payload: { bookId, kind: body.kind, origin: body.origin },
    }, c.executionCtx);

    const row = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundError('Reference');
    }
    return c.json({ ok: true, data: toReferenceDTO(row) }, 201);
  },
);

creatorRouter.patch(
  '/creator/books/:bookId/references/:id',
  readerAuth,
  zValidator('json', ReferenceUpdateSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const row = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    if (!row) {
      throw new NotFoundError('Reference');
    }

    const body = c.req.valid('json');
    const now = new Date().toISOString();
    // Any edit bumps the revision: feedback that pinned the old revision
    // then shows the honest "reference updated since" drift marker.
    await execute(
      c.env,
      `UPDATE book_references
       SET title = ?, content = ?, revision = revision + 1, updated_at = ?
       WHERE id = ? AND book_id = ?`,
      [
        body.title ?? row.title,
        body.content ?? row.content,
        now,
        id,
        bookId,
      ],
    );

    await logAudit(c.env, {
      entityType: 'book-reference',
      entityId: id,
      action: 'updated',
      actorEmail: auth.email,
      payload: { bookId },
    }, c.executionCtx);

    const updated = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ?`,
      [id],
    );
    if (!updated) {
      throw new NotFoundError('Reference');
    }
    return c.json({ ok: true, data: toReferenceDTO(updated) });
  },
);

creatorRouter.delete(
  '/creator/books/:bookId/references/:id',
  readerAuth,
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const row = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    if (!row) {
      throw new NotFoundError('Reference');
    }

    await execute(
      c.env,
      `DELETE FROM book_references WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    await logAudit(c.env, {
      entityType: 'book-reference',
      entityId: id,
      action: 'deleted',
      actorEmail: auth.email,
      payload: { bookId, kind: row.kind },
    }, c.executionCtx);

    return c.json({ ok: true, data: { id } });
  },
);

creatorRouter.post(
  '/creator/books/:bookId/references/:id/verify',
  readerAuth,
  zValidator('json', ReferenceVerifySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const row = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ? AND book_id = ?`,
      [id, bookId],
    );
    if (!row) {
      throw new NotFoundError('Reference');
    }
    if (row.origin !== 'external') {
      throw new AppError('Only external citations carry verification state', 'NOT_EXTERNAL', 422);
    }

    const body = c.req.valid('json');
    const now = new Date().toISOString();
    // Verification state changes always append the evidence note to the
    // content — the record shows WHY it was (un)verified, not just that.
    const stamp = body.verified ? 'verified' : 'unverified';
    const appended = `${row.content}\n[${stamp} ${now.slice(0, 10)}: ${body.evidenceNote}]`;

    await execute(
      c.env,
      `UPDATE book_references SET verified = ?, content = ?, updated_at = ? WHERE id = ? AND book_id = ?`,
      [body.verified ? 1 : 0, appended, now, id, bookId],
    );
    await logAudit(c.env, {
      entityType: 'book-reference',
      entityId: id,
      action: body.verified ? 'verified' : 'unverified',
      actorEmail: auth.email,
      payload: { bookId },
    }, c.executionCtx);

    const updated = await queryFirst<ReferenceRow>(
      c.env,
      `SELECT * FROM book_references WHERE id = ?`,
      [id],
    );
    if (!updated) {
      throw new NotFoundError('Reference');
    }
    return c.json({ ok: true, data: toReferenceDTO(updated) });
  },
);

creatorRouter.get('/creator/books/:bookId/style', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
  if (mismatch) return mismatch.response;
  await requireCreator(c.env, auth, bookId);

  const row = await queryFirst<JsonRow>(
    c.env,
    `SELECT * FROM style_profile WHERE book_id = ?`,
    [bookId],
  );
  if (!row) {
    return c.json({ ok: true, data: null });
  }
  return c.json({
    ok: true,
    data: {
      language: row.language ?? null,
      narrativePerson: row.narrative_person ?? null,
      tense: row.tense ?? null,
      dialogueConventions: row.dialogue_conventions ?? null,
      dialectNotes: row.dialect_notes ?? null,
      terminology: row.terminology ?? null,
      intentionalExceptions: row.intentional_exceptions ?? null,
      status: row.status,
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approved_at ?? null,
      revision: row.revision,
    },
  });
});

creatorRouter.put(
  '/creator/books/:bookId/style',
  readerAuth,
  zValidator('json', StyleProfileSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(c.env, auth, bookId, c.executionCtx, getRequestTraceId(c));
    if (mismatch) return mismatch.response;
    await requireCreator(c.env, auth, bookId);

    const body = c.req.valid('json');
    const now = new Date().toISOString();
    const existing = await queryFirst<JsonRow>(
      c.env,
      `SELECT revision FROM style_profile WHERE book_id = ?`,
      [bookId],
    );

    const approved = body.status === 'approved';
    await execute(
      c.env,
      `INSERT INTO style_profile
        (book_id, language, narrative_person, tense, dialogue_conventions, dialect_notes, terminology, intentional_exceptions, status, approved_by, approved_at, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(book_id) DO UPDATE SET
         language = excluded.language,
         narrative_person = excluded.narrative_person,
         tense = excluded.tense,
         dialogue_conventions = excluded.dialogue_conventions,
         dialect_notes = excluded.dialect_notes,
         terminology = excluded.terminology,
         intentional_exceptions = excluded.intentional_exceptions,
         status = excluded.status,
         approved_by = excluded.approved_by,
         approved_at = excluded.approved_at,
         revision = style_profile.revision + 1,
         updated_at = excluded.updated_at`,
      [
        bookId,
        body.language ?? null,
        body.narrativePerson ?? null,
        body.tense ?? null,
        body.dialogueConventions ?? null,
        body.dialectNotes ?? null,
        body.terminology ?? null,
        body.intentionalExceptions ?? null,
        body.status,
        approved ? auth.email : null,
        approved ? now : null,
        now,
      ],
    );

    await logAudit(c.env, {
      entityType: 'style-profile',
      entityId: bookId,
      action: approved ? 'approved' : 'updated',
      actorEmail: auth.email,
      payload: { bookId, revision: (existing?.revision as number | undefined ?? 0) + 1 },
    }, c.executionCtx);

    return c.json({
      ok: true,
      data: {
        bookId,
        status: body.status,
        approvedBy: approved ? auth.email : null,
        approvedAt: approved ? now : null,
        revision: (existing?.revision as number | undefined ?? 0) + 1,
      },
    });
  },
);
