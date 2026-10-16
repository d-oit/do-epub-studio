import type { Context } from 'hono';
import type { Env } from '../../lib/env';
import { queryFirst, queryAll, transaction } from '../../db/client';
import { logAudit } from '../../audit';
import {
  migrateAnnotations,
  type MigrationCandidate,
  type ChapterContentItem,
} from '@do-epub-studio/shared';
import type { RevisionMigrate } from '@do-epub-studio/schema';
import { NotFoundError } from '../../lib/http-errors';

type AdminBookContext = Context<
  {
    Bindings: Env;
    Variables: { adminUser: { email: string; id: string; role: string } };
  },
  '/:id/revisions'
>;

type AdminMigrateContext = Context<
  {
    Bindings: Env;
    Variables: { adminUser: { email: string; id: string; role: string } };
  },
  '/:id/revisions/:revisionId/migrate'
>;

export async function handleGetBookRevisions(c: AdminBookContext): Promise<Response> {
  const bookId = c.req.param('id');
  const book = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE id = ? AND archived_at IS NULL',
    [bookId],
  );
  if (!book) {
    throw new NotFoundError('Book');
  }

  const revisions = await queryAll<{
    id: string;
    book_id: string;
    storage_key: string;
    original_filename: string;
    mime_type: string;
    file_size_bytes: number;
    sha256: string | null;
    epub_version: string | null;
    created_at: string;
  }>(
    c.env,
    `SELECT id, book_id, storage_key, original_filename, mime_type, file_size_bytes, sha256, epub_version, created_at
     FROM book_files
     WHERE book_id = ?
     ORDER BY created_at DESC`,
    [bookId],
  );

  return c.json({ ok: true, data: revisions });
}

export async function handleMigrateBookRevision(
  c: AdminMigrateContext,
  body: RevisionMigrate,
): Promise<Response> {
  const bookId = c.req.param('id');
  const targetRevisionId = c.req.param('revisionId');

  const book = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM books WHERE id = ? AND archived_at IS NULL',
    [bookId],
  );
  if (!book) {
    throw new NotFoundError('Book');
  }

  const targetRevision = await queryFirst<{ id: string; sha256: string | null }>(
    c.env,
    'SELECT id, sha256 FROM book_files WHERE id = ? AND book_id = ?',
    [targetRevisionId, bookId],
  );
  if (!targetRevision) {
    throw new NotFoundError('Revision');
  }

  const priorRevision = await queryFirst<{ id: string }>(
    c.env,
    'SELECT id FROM book_files WHERE book_id = ? AND id != ? ORDER BY created_at DESC LIMIT 1',
    [bookId, targetRevisionId],
  );

  const comments = await queryAll<{
    id: string;
    chapter_ref: string | null;
    cfi_range: string | null;
    selected_text: string | null;
    revision_id: string | null;
    original_cfi: string | null;
    original_chapter_ref: string | null;
    original_selected_text: string | null;
  }>(
    c.env,
    "SELECT id, chapter_ref, cfi_range, selected_text, revision_id, original_cfi, original_chapter_ref, original_selected_text FROM comments WHERE book_id = ? AND status != 'deleted'",
    [bookId],
  );

  const highlights = await queryAll<{
    id: string;
    chapter_ref: string | null;
    cfi_range: string | null;
    selected_text: string | null;
    revision_id: string | null;
    original_cfi: string | null;
    original_chapter_ref: string | null;
    original_selected_text: string | null;
  }>(
    c.env,
    'SELECT id, chapter_ref, cfi_range, selected_text, revision_id, original_cfi, original_chapter_ref, original_selected_text FROM highlights WHERE book_id = ?',
    [bookId],
  );

  const candidates: MigrationCandidate[] = [
    ...comments.map((cm) => ({
      id: cm.id,
      type: 'comment' as const,
      chapterRef: cm.chapter_ref,
      cfiRange: cm.cfi_range,
      selectedText: cm.selected_text,
      revisionId: cm.revision_id,
      originalCfi: cm.original_cfi,
      originalChapterRef: cm.original_chapter_ref,
      originalSelectedText: cm.original_selected_text,
    })),
    ...highlights.map((hl) => ({
      id: hl.id,
      type: 'highlight' as const,
      chapterRef: hl.chapter_ref,
      cfiRange: hl.cfi_range,
      selectedText: hl.selected_text,
      revisionId: hl.revision_id,
      originalCfi: hl.original_cfi,
      originalChapterRef: hl.original_chapter_ref,
      originalSelectedText: hl.original_selected_text,
    })),
  ];

  const chapters: ChapterContentItem[] = body.chapters ?? [];
  const report = migrateAnnotations(candidates, chapters, targetRevisionId);

  const updateStatements: { sql: string; args?: (string | number | null)[] }[] = [];
  const now = new Date().toISOString();

  for (const decision of report.decisions) {
    if (decision.migrationOutcome === 'already_migrated') continue;

    const isComment = comments.some((cm) => cm.id === decision.annotationId);
    const table = isComment ? 'comments' : 'highlights';

    updateStatements.push({
      sql: `UPDATE ${table} SET
            chapter_ref = ?,
            cfi_range = ?,
            anchor_status = ?,
            confidence = ?,
            migration_outcome = ?,
            revision_id = ?,
            original_cfi = COALESCE(original_cfi, ?),
            original_chapter_ref = COALESCE(original_chapter_ref, ?),
            original_selected_text = COALESCE(original_selected_text, ?),
            updated_at = ?
            WHERE id = ?`,
      args: [
        decision.chapterRef,
        decision.cfiRange,
        decision.anchorStatus,
        decision.confidence,
        decision.migrationOutcome,
        targetRevisionId,
        decision.originalCfi,
        decision.originalChapterRef,
        decision.originalSelectedText,
        now,
        decision.annotationId,
      ],
    });
  }

  const migrationId = crypto.randomUUID();
  updateStatements.push({
    sql: `INSERT INTO annotation_migrations (id, book_id, source_revision_id, target_revision_id, status, total_count, migrated_count, orphaned_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
    args: [
      migrationId,
      bookId,
      priorRevision?.id ?? null,
      targetRevisionId,
      report.totalCount,
      report.migratedCount,
      report.orphanedCount,
      now,
      now,
    ],
  });

  if (updateStatements.length > 0) {
    await transaction(c.env, updateStatements);
  }

  await logAudit(
    c.env,
    {
      entityType: 'book',
      entityId: bookId,
      action: 'annotation_migrated',
      payload: {
        migrationId,
        targetRevisionId,
        total: report.totalCount,
        migrated: report.migratedCount,
        orphaned: report.orphanedCount,
        needsReview: report.needsReviewCount,
      },
    },
    c.executionCtx,
  );

  return c.json({
    ok: true,
    data: {
      migrationId,
      bookId,
      targetRevisionId,
      sourceRevisionId: priorRevision?.id ?? null,
      totalCount: report.totalCount,
      migratedCount: report.migratedCount,
      orphanedCount: report.orphanedCount,
      needsReviewCount: report.needsReviewCount,
      outcomes: report.outcomes,
    },
  });
}
