import { EPUBCHECK_VERSION } from '@do-epub-studio/schema';
import { execute, queryFirst } from '../db/client';
import { enqueueEpubValidation } from './epub-validation-queue';
import { clearBookSearchIndex, replaceBookSearchIndex } from './book-search-index';
import type { BookChapterInput } from './book-search-index';
import type { Env } from './env';

export interface FinalizeBookEpubRevisionInput {
  bookId: string;
  fileId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256?: string | null;
  epubVersion?: string | null;
  validationResults?: unknown;
  chapters?: readonly BookChapterInput[];
  createdAt: string;
}

/** Records one immutable revision and runs the shared index/cache/validation path. */
export async function finalizeBookEpubRevision(
  env: Env,
  input: FinalizeBookEpubRevisionInput,
): Promise<{ inserted: boolean }> {
  const insertedRevision = await queryFirst<{ id: string }>(
    env,
    `INSERT OR IGNORE INTO book_files
      (id, book_id, storage_provider, storage_key, original_filename, mime_type,
       file_size_bytes, sha256, epub_version, validation_results_json, created_at)
     VALUES (?, ?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      input.fileId,
      input.bookId,
      input.storageKey,
      input.originalFilename,
      input.mimeType,
      input.fileSizeBytes,
      input.sha256 ?? null,
      input.epubVersion ?? null,
      input.validationResults === undefined ? null : JSON.stringify(input.validationResults),
      input.createdAt,
    ],
  );

  const report = await queryFirst<{ id: string; status: string }>(
    env,
    `SELECT id, status FROM epub_validation_reports
     WHERE book_id = ? AND revision_id = ? ORDER BY created_at DESC LIMIT 1`,
    [input.bookId, input.fileId],
  );
  if (!report) {
    await execute(
      env,
      `INSERT INTO epub_validation_reports
        (id, book_id, revision_id, validator_version, status, safety_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
      [
        crypto.randomUUID(),
        input.bookId,
        input.fileId,
        EPUBCHECK_VERSION,
        input.createdAt,
        input.createdAt,
      ],
    );
  }

  if (insertedRevision || !report || report.status === 'pending') {
    await enqueueEpubValidation(env, { bookId: input.bookId, revisionId: input.fileId });
  }
  if (input.chapters && input.chapters.length > 0) {
    await replaceBookSearchIndex(env, input.bookId, input.chapters);
  } else {
    await clearBookSearchIndex(env, input.bookId);
  }

  return { inserted: Boolean(insertedRevision) };
}
