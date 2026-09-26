import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, JsonRow } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { logAudit } from '../audit';
import { getGrantByBookAndSession, computeCapabilities } from '../auth/password';
import {
  FeedbackCreateSchema,
  FeedbackReplySchema,
  FeedbackListQuerySchema,
} from '@do-epub-studio/schema';
import { assertBookAccess } from '../lib/tenant-isolation';
import { getRequestTraceId } from '../lib/api-error';
import {
  currentReferenceRevisions,
  resolveProvenance,
  type ItemProvenance,
} from '../lib/feedback-provenance';
import { readerAuth } from '../middleware/auth';
import { NotFoundError, ForbiddenError, AppError } from '../lib/http-errors';

export const feedbackRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

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
  reference_revisions: string | null;
  anchor_state: string;
  created_at: string;
  updated_at: string;
}

interface ReplyRow extends JsonRow {
  id: string;
  feedback_id: string;
  author_email: string;
  author_role: string;
  body: string;
  created_at: string;
}

function toAnchor(row: FeedbackRow): Record<string, string | null> {
  return {
    bookFileId: row.book_file_id,
    chapterRef: row.chapter_ref,
    cfi: row.cfi,
    selectedText: row.selected_text,
    prefix: row.prefix,
    suffix: row.suffix,
  };
}

function toReaderDTO(
  row: FeedbackRow,
  replies: ReplyRow[] = [],
  replyCount = 0,
  provenance: ItemProvenance,
): Record<string, unknown> {
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    body: row.body,
    proposedText: row.proposed_text,
    anchor: toAnchor(row),
    anchorState: provenance.anchorState,
    referenceRevisions: provenance.pinnedReferences,
    referencesDrifted: provenance.referencesDrifted,
    status: row.status,
    isOwn: true,
    replyCount,
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorRole: r.author_role,
      isOwn: true,
      createdAt: r.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A reader-facing item with its read-time provenance resolved. */
async function readerItem(
  env: Env,
  row: FeedbackRow,
  replies: ReplyRow[] = [],
  replyCount = 0,
  baseline?: Record<string, number>,
): Promise<Record<string, unknown>> {
  return toReaderDTO(row, replies, replyCount, await resolveProvenance(env, row, baseline));
}

async function resolveCanComment(env: Env, auth: AuthContext, bookId: string): Promise<boolean> {
  // Use session capabilities if bookId matches session, otherwise re-fetch
  let canComment = auth.capabilities?.canComment;
  if (auth.bookId !== bookId) {
    const grant = await getGrantByBookAndSession(env, bookId, auth.email);
    if (grant) {
      canComment = computeCapabilities(grant).canComment;
    } else {
      canComment = false;
    }
  }
  return canComment === true;
}

async function repliesFor(env: Env, feedbackId: string): Promise<ReplyRow[]> {
  return queryAll<ReplyRow>(
    env,
    `SELECT * FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC LIMIT 500`,
    [feedbackId],
  );
}

/** Own item or 404 — never 403, so one reader cannot probe another's items. */
async function ownFeedbackOr404(
  env: Env,
  id: string,
  bookId: string,
  email: string,
): Promise<FeedbackRow> {
  const row = await queryFirst<FeedbackRow>(
    env,
    `SELECT * FROM editorial_feedback WHERE id = ? AND book_id = ? AND submitter_email = ?`,
    [id, bookId, email],
  );
  if (!row) {
    throw new NotFoundError('Feedback');
  }
  return row;
}

feedbackRouter.post(
  '/books/:bookId/feedback',
  readerAuth,
  zValidator('json', FeedbackCreateSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    if (!(await resolveCanComment(c.env, auth, bookId))) {
      throw new ForbiddenError('Access denied');
    }

    const body = c.req.valid('json');

    // Stable mutation identity: replaying the same submission returns the
    // existing item instead of creating a duplicate.
    const existing = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE mutation_id = ?`,
      [body.mutationId],
    );
    if (existing) {
      if (existing.book_id !== bookId || existing.submitter_email !== auth.email) {
        throw new ForbiddenError('Access denied');
      }
      return c.json({
        ok: true,
        data: await readerItem(c.env, existing, await repliesFor(c.env, existing.id)),
      });
    }

    // Anchor provenance server-side: a supplied book file must belong to this
    // book; its stored SHA-256 is retained as the source identity.
    let sourceSha: string | null = null;
    if (body.anchor.bookFileId) {
      const file = await queryFirst<{ book_id: string; sha256: string | null }>(
        c.env,
        `SELECT book_id, sha256 FROM book_files WHERE id = ?`,
        [body.anchor.bookFileId],
      );
      if (!file || file.book_id !== bookId) {
        throw new AppError('Anchor book file does not belong to this book', 'INVALID_ANCHOR', 400);
      }
      sourceSha = file.sha256;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Evidence pinning (COL-03): a reader cannot read the book's references,
    // so when the client sends no pins the server records the revision of
    // every reference the book has at acceptance time. A later reference edit
    // then shows the honest "reference updated since" marker instead of
    // pretending the evidence never moved.
    const pins = body.referenceRevisions ?? (await currentReferenceRevisions(c.env, bookId));
    const pinnedJson = Object.keys(pins).length > 0 ? JSON.stringify(pins) : null;

    await execute(
      c.env,
      `INSERT INTO editorial_feedback
        (id, book_id, book_file_id, source_sha256, chapter_ref, cfi, selected_text, prefix, suffix,
         kind, category, body, proposed_text, visibility, submitter_email, status, mutation_id, reference_revisions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?, 'open', ?, ?, ?, ?)`,
      [
        id,
        bookId,
        body.anchor.bookFileId ?? null,
        sourceSha,
        body.anchor.chapterRef ?? null,
        body.anchor.cfi ?? null,
        body.anchor.selectedText,
        body.anchor.prefix ?? null,
        body.anchor.suffix ?? null,
        body.kind,
        body.category,
        body.body,
        body.proposedText ?? null,
        auth.email,
        body.mutationId,
        pinnedJson,
        now,
        now,
      ],
    );

    await execute(
      c.env,
      `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
       VALUES (?, ?, ?, 'created', ?)`,
      [crypto.randomUUID(), id, auth.email, now],
    );

    await logAudit(
      c.env,
      {
        entityType: 'editorial-feedback',
        entityId: id,
        action: 'create',
        actorEmail: auth.email,
        payload: { bookId, kind: body.kind, category: body.category },
      },
      c.executionCtx,
    );

    const row = await queryFirst<FeedbackRow>(
      c.env,
      `SELECT * FROM editorial_feedback WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundError('Feedback');
    }

    return c.json({ ok: true, data: await readerItem(c.env, row) }, 201);
  },
);

feedbackRouter.get(
  '/books/:bookId/feedback',
  readerAuth,
  zValidator('query', FeedbackListQuerySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    const { status, category, limit, offset } = c.req.valid('query');
    const args: (string | number)[] = [bookId, auth.email];
    let sql = `SELECT * FROM editorial_feedback WHERE book_id = ? AND submitter_email = ?`;
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

    // Replies are shown inline in the reader's own list, so load them in one
    // batched query instead of leaving every reader without the creator's
    // answer until they open the item.
    const repliesByFeedback = new Map<string, ReplyRow[]>();
    if (rows.length > 0) {
      const placeholders = rows.map(() => '?').join(', ');
      const allReplies = await queryAll<ReplyRow>(
        c.env,
        `SELECT * FROM feedback_replies WHERE feedback_id IN (${placeholders}) ORDER BY created_at ASC LIMIT 500`,
        rows.map((row) => row.id),
      );
      for (const reply of allReplies) {
        const bucket = repliesByFeedback.get(reply.feedback_id) ?? [];
        bucket.push(reply);
        repliesByFeedback.set(reply.feedback_id, bucket);
      }
    }

    // One baseline query per request: every item's pinned revisions are
    // compared against the book's current references.
    const baseline = await currentReferenceRevisions(c.env, bookId);

    const data = await Promise.all(
      rows.map(async (row) => {
        const replies = repliesByFeedback.get(row.id) ?? [];
        return readerItem(c.env, row, replies, replies.length, baseline);
      }),
    );

    return c.json({ ok: true, data });
  },
);

feedbackRouter.get('/books/:bookId/feedback/:id', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const id = c.req.param('id');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(
    c.env,
    auth,
    bookId,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;

  const row = await ownFeedbackOr404(c.env, id, bookId, auth.email);
  return c.json({ ok: true, data: await readerItem(c.env, row, await repliesFor(c.env, id)) });
});

feedbackRouter.post('/books/:bookId/feedback/:id/withdraw', readerAuth, async (c) => {
  const bookId = c.req.param('bookId');
  const id = c.req.param('id');
  const auth = c.get('auth');

  const mismatch = await assertBookAccess(
    c.env,
    auth,
    bookId,
    c.executionCtx,
    getRequestTraceId(c),
  );
  if (mismatch) return mismatch.response;

  const row = await ownFeedbackOr404(c.env, id, bookId, auth.email);
  const now = new Date().toISOString();

  if (row.status !== 'withdrawn') {
    await execute(
      c.env,
      `UPDATE editorial_feedback SET status = 'withdrawn', updated_at = ? WHERE id = ?`,
      [now, id],
    );
    await execute(
      c.env,
      `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
       VALUES (?, ?, ?, 'withdrawn', ?)`,
      [crypto.randomUUID(), id, auth.email, now],
    );
    await logAudit(
      c.env,
      {
        entityType: 'editorial-feedback',
        entityId: id,
        action: 'withdraw',
        actorEmail: auth.email,
        payload: { bookId },
      },
      c.executionCtx,
    );
  }

  const updated = await ownFeedbackOr404(c.env, id, bookId, auth.email);
  return c.json({ ok: true, data: await readerItem(c.env, updated, await repliesFor(c.env, id)) });
});

feedbackRouter.post(
  '/books/:bookId/feedback/:id/replies',
  readerAuth,
  zValidator('json', FeedbackReplySchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const id = c.req.param('id');
    const auth = c.get('auth');

    const mismatch = await assertBookAccess(
      c.env,
      auth,
      bookId,
      c.executionCtx,
      getRequestTraceId(c),
    );
    if (mismatch) return mismatch.response;

    if (!(await resolveCanComment(c.env, auth, bookId))) {
      throw new ForbiddenError('Access denied');
    }

    const row = await ownFeedbackOr404(c.env, id, bookId, auth.email);
    if (row.status === 'withdrawn') {
      throw new AppError('Feedback is withdrawn', 'FEEDBACK_WITHDRAWN', 422);
    }

    const body = c.req.valid('json');
    const replyId = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      c.env,
      `INSERT INTO feedback_replies (id, feedback_id, author_email, author_role, body, created_at)
       VALUES (?, ?, ?, 'reader', ?, ?)`,
      [replyId, id, auth.email, body.body, now],
    );
    await execute(
      c.env,
      `INSERT INTO feedback_events (id, feedback_id, actor_email, event, created_at)
       VALUES (?, ?, ?, 'replied', ?)`,
      [crypto.randomUUID(), id, auth.email, now],
    );

    const updated = await ownFeedbackOr404(c.env, id, bookId, auth.email);
    return c.json(
      { ok: true, data: await readerItem(c.env, updated, await repliesFor(c.env, id)) },
      201,
    );
  },
);
