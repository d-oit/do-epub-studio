import type { Env } from '../lib/env';
import { requireAuth } from '../auth/middleware';
import { queryFirst, queryAll, execute } from '../db/client';
import { jsonResponse } from '../lib/responses';

interface ProgressRow {
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  progress_percent: number;
  updated_at: string;
}

interface BookmarkRow {
  id: string;
  book_id: string;
  user_email: string;
  locator_json: string;
  label: string | null;
  created_at: string;
}

interface HighlightRow {
  id: string;
  book_id: string;
  user_email: string;
  chapter_ref: string | null;
  cfi_range: string | null;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export async function handleGetProgress(
  env: Env,
  request: Request,
  bookId: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const progress = (await queryFirst(
    env,
    `SELECT * FROM reading_progress WHERE book_id = ? AND user_email = ?`,
    [bookId, auth.email],
  )) as ProgressRow | null;

  if (!progress) {
    return jsonResponse({
      ok: true,
      data: { locator: null, progressPercent: 0 },
    });
  }

  return jsonResponse({
    ok: true,
    data: {
      locator: JSON.parse(progress.locator_json),
      progressPercent: progress.progress_percent,
      updatedAt: progress.updated_at,
    },
  });
}

export async function handleUpdateProgress(
  env: Env,
  request: Request,
  bookId: string,
  body: { locator: unknown; progressPercent: number },
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  if (!auth.capabilities.canRead) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const locatorJson = JSON.stringify(body.locator);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO reading_progress (id, book_id, user_email, locator_json, progress_percent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(book_id, user_email) DO UPDATE SET
       locator_json = excluded.locator_json,
       progress_percent = excluded.progress_percent,
       updated_at = excluded.updated_at`,
    [id, bookId, auth.email, locatorJson, body.progressPercent, now],
  );

  return jsonResponse({
    ok: true,
    data: { locator: body.locator, progressPercent: body.progressPercent, updatedAt: now },
  });
}

export async function handleListBookmarks(
  env: Env,
  request: Request,
  bookId: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const bookmarks = (await queryAll(
    env,
    `SELECT * FROM bookmarks WHERE book_id = ? AND user_email = ? ORDER BY created_at DESC`,
    [bookId, auth.email],
  )) as unknown as BookmarkRow[];

  return jsonResponse({
    ok: true,
    data: bookmarks.map((bm) => ({
      id: bm.id,
      locator: JSON.parse(bm.locator_json),
      label: bm.label,
      createdAt: bm.created_at,
    })),
  });
}

export async function handleCreateBookmark(
  env: Env,
  request: Request,
  bookId: string,
  body: { locator: unknown; label?: string },
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  if (!auth.capabilities.canBookmark) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const id = crypto.randomUUID();
  const locatorJson = JSON.stringify(body.locator);
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO bookmarks (id, book_id, user_email, locator_json, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, bookId, auth.email, locatorJson, body.label ?? null, now],
  );

  return jsonResponse(
    {
      ok: true,
      data: { id, locator: body.locator, label: body.label, createdAt: now },
    },
    201,
  );
}

export async function handleDeleteBookmark(
  env: Env,
  request: Request,
  bookId: string,
  bookmarkId: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  await execute(env, `DELETE FROM bookmarks WHERE id = ? AND book_id = ? AND user_email = ?`, [
    bookmarkId,
    bookId,
    auth.email,
  ]);

  return jsonResponse({ ok: true });
}

export async function handleListHighlights(
  env: Env,
  request: Request,
  bookId: string,
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const highlights = (await queryAll(
    env,
    `SELECT * FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at DESC`,
    [bookId, auth.email],
  )) as unknown as HighlightRow[];

  return jsonResponse({
    ok: true,
    data: highlights.map((hl) => ({
      id: hl.id,
      chapterRef: hl.chapter_ref,
      cfiRange: hl.cfi_range,
      selectedText: hl.selected_text,
      note: hl.note,
      color: hl.color,
      createdAt: hl.created_at,
      updatedAt: hl.updated_at,
    })),
  });
}

export async function handleCreateHighlight(
  env: Env,
  request: Request,
  bookId: string,
  body: {
    chapterRef?: string;
    cfiRange?: string;
    selectedText: string;
    note?: string;
    color?: string;
  },
): Promise<Response> {
  const auth = await requireAuth(env, request);

  if (!auth) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  if (!auth.capabilities.canHighlight) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await execute(
    env,
    `INSERT INTO highlights (id, book_id, user_email, chapter_ref, cfi_range, selected_text, note, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bookId,
      auth.email,
      body.chapterRef ?? null,
      body.cfiRange ?? null,
      body.selectedText,
      body.note ?? null,
      body.color ?? '#ffff00',
      now,
      now,
    ],
  );

  return jsonResponse(
    {
      ok: true,
      data: {
        id,
        chapterRef: body.chapterRef,
        cfiRange: body.cfiRange,
        selectedText: body.selectedText,
        note: body.note,
        color: body.color ?? '#ffff00',
        createdAt: now,
        updatedAt: now,
      },
    },
    201,
  );
}
