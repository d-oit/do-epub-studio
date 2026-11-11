import { EpubRunnerResultSchema } from '@do-epub-studio/schema';
import {
  exportAnnotationsToEpub,
  EpubAnnotationExportError,
  EPUB_ANNOTATION_EXPORT_LIMITS,
  type EpubExportAnnotation,
} from '@do-epub-studio/reader-core/packager';
import { queryAll, queryFirst } from '../db/client';
import { getValidatedRunnerUrl } from './epub-validation-queue';
import type { Env, JsonRow } from './env';

const MAX_RUNNER_RESPONSE_BYTES = 300_000;
const RUNNER_TIMEOUT_MS = 125_000;
const MAX_ANNOTATIONS = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotations;
const MAX_ANNOTATION_TEXT_BYTES = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotationTextBytes;

export type EpubAnnotationExportFailureCode =
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_UNAVAILABLE'
  | 'EPUBCHECK_UNAVAILABLE'
  | 'EPUBCHECK_INVALID_RESPONSE'
  | 'EPUBCHECK_INTEGRITY_ERROR'
  | 'EPUBCHECK_REJECTED';

export class EpubAnnotationExportFailure extends Error {
  constructor(
    readonly code: EpubAnnotationExportFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'EpubAnnotationExportFailure';
  }
}

interface SourceRevisionRow extends JsonRow {
  id: string;
  storage_key: string;
  file_size_bytes: number;
}

interface AnnotationBudgetRow extends JsonRow {
  row_count: number;
  text_bytes: number;
}

interface HighlightExportRow extends JsonRow {
  id: string;
  selected_text: string;
  note: string | null;
  chapter_ref: string | null;
  cfi_range: string | null;
  revision_id: string | null;
  original_cfi: string | null;
  original_chapter_ref: string | null;
  original_selected_text: string | null;
  anchor_status: string | null;
}

interface CommentExportRow extends JsonRow {
  id: string;
  body: string;
  selected_text: string | null;
  chapter_ref: string | null;
  cfi_range: string | null;
  parent_comment_id: string | null;
  revision_id: string | null;
  original_cfi: string | null;
  original_chapter_ref: string | null;
  original_selected_text: string | null;
  anchor_status: string | null;
}

interface BookmarkExportRow extends JsonRow {
  id: string;
  label: string | null;
  locator_json: string;
}

function annotationBudgetSql(
  table: 'highlights' | 'comments' | 'bookmarks',
  columns: readonly string[],
  extraFilter = '',
): string {
  const byteLengths = columns
    .map((column) => `length(CAST(COALESCE(${column}, '') AS BLOB))`)
    .join(' + ');
  return `SELECT COUNT(*) AS row_count, COALESCE(SUM(text_bytes), 0) AS text_bytes
    FROM (
      SELECT ${byteLengths} AS text_bytes FROM ${table}
      WHERE book_id = ? AND user_email = ?${extraFilter} LIMIT ?
    ) AS bounded_annotations`;
}

function requireValidBudget(row: AnnotationBudgetRow | null): AnnotationBudgetRow {
  if (
    !row ||
    !Number.isSafeInteger(row.row_count) ||
    row.row_count < 0 ||
    !Number.isSafeInteger(row.text_bytes) ||
    row.text_bytes < 0
  ) {
    throw new Error('Invalid EPUB annotation export budget result');
  }
  return row;
}

function textValue(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function bookmarkAnnotation(row: BookmarkExportRow): EpubExportAnnotation {
  let locator: unknown;
  try {
    locator = JSON.parse(row.locator_json) as unknown;
  } catch {
    return {
      id: row.id,
      type: 'bookmark',
      body: '',
      label: row.label,
      locatorContext: row.locator_json,
    };
  }

  if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
    return {
      id: row.id,
      type: 'bookmark',
      body: '',
      label: row.label,
      locatorContext: row.locator_json,
    };
  }

  const value = locator as Record<string, unknown>;
  const cfi = textValue(value, 'cfi', 'cfiRange', 'cfi_range');
  const chapterRef = textValue(value, 'chapterRef', 'chapter_ref');
  const selectedText = textValue(value, 'selectedText', 'selected_text');
  const hasKnownLocator = cfi !== null || chapterRef !== null || selectedText !== null;
  return {
    id: row.id,
    type: 'bookmark',
    body: '',
    label: row.label,
    cfi,
    chapterRef,
    selectedText,
    revisionId: textValue(value, 'revisionId', 'revision_id'),
    anchorStatus: textValue(value, 'anchorStatus', 'anchor_status'),
    originalCfi: textValue(value, 'originalCfi', 'original_cfi'),
    originalChapterRef: textValue(value, 'originalChapterRef', 'original_chapter_ref'),
    originalSelectedText: textValue(value, 'originalSelectedText', 'original_selected_text'),
    locatorContext: hasKnownLocator ? null : row.locator_json,
  };
}

async function readUserAnnotations(
  env: Env,
  bookId: string,
  userEmail: string,
): Promise<EpubExportAnnotation[]> {
  const [highlightBudgetResult, commentBudgetResult, bookmarkBudgetResult] = await Promise.all([
    queryFirst<AnnotationBudgetRow>(
      env,
      annotationBudgetSql('highlights', [
        'id',
        'selected_text',
        'note',
        'chapter_ref',
        'cfi_range',
        'revision_id',
        'original_cfi',
        'original_chapter_ref',
        'original_selected_text',
        'anchor_status',
      ]),
      [bookId, userEmail, MAX_ANNOTATIONS + 1],
    ),
    queryFirst<AnnotationBudgetRow>(
      env,
      annotationBudgetSql(
        'comments',
        [
          'id',
          'body',
          'selected_text',
          'chapter_ref',
          'cfi_range',
          'parent_comment_id',
          'revision_id',
          'original_cfi',
          'original_chapter_ref',
          'original_selected_text',
          'anchor_status',
        ],
        " AND status != 'deleted'",
      ),
      [bookId, userEmail, MAX_ANNOTATIONS + 1],
    ),
    queryFirst<AnnotationBudgetRow>(
      env,
      annotationBudgetSql('bookmarks', ['id', 'label', 'locator_json']),
      [bookId, userEmail, MAX_ANNOTATIONS + 1],
    ),
  ]);
  const budgets = [
    requireValidBudget(highlightBudgetResult),
    requireValidBudget(commentBudgetResult),
    requireValidBudget(bookmarkBudgetResult),
  ];
  const annotationCount = budgets.reduce((total, budget) => total + budget.row_count, 0);
  const textBytes = budgets.reduce((total, budget) => total + budget.text_bytes, 0);
  if (annotationCount > MAX_ANNOTATIONS || textBytes > MAX_ANNOTATION_TEXT_BYTES) {
    throw new EpubAnnotationExportError(
      'ANNOTATIONS_TOO_LARGE',
      'The annotations exceed the EPUB export limits',
    );
  }

  const rowLimit = MAX_ANNOTATIONS + 1;
  const [highlights, comments, bookmarks] = await Promise.all([
    queryAll<HighlightExportRow>(
      env,
      `SELECT id, selected_text, note, chapter_ref, cfi_range, revision_id, original_cfi,
              original_chapter_ref, original_selected_text, anchor_status
       FROM highlights WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
      [bookId, userEmail, rowLimit],
    ),
    queryAll<CommentExportRow>(
      env,
      `SELECT id, body, selected_text, chapter_ref, cfi_range, parent_comment_id, revision_id,
              original_cfi, original_chapter_ref, original_selected_text, anchor_status
       FROM comments WHERE book_id = ? AND user_email = ? AND status != 'deleted'
       ORDER BY created_at ASC LIMIT ?`,
      [bookId, userEmail, rowLimit],
    ),
    queryAll<BookmarkExportRow>(
      env,
      `SELECT id, label, locator_json FROM bookmarks
       WHERE book_id = ? AND user_email = ? ORDER BY created_at ASC LIMIT ?`,
      [bookId, userEmail, rowLimit],
    ),
  ]);
  if (highlights.length + comments.length + bookmarks.length > MAX_ANNOTATIONS) {
    throw new EpubAnnotationExportError(
      'ANNOTATIONS_TOO_LARGE',
      'The annotations exceed the EPUB export limits',
    );
  }

  return [
    ...highlights.map((row): EpubExportAnnotation => ({
      id: row.id,
      type: 'highlight',
      body: '',
      selectedText: row.selected_text,
      note: row.note,
      chapterRef: row.chapter_ref,
      cfi: row.cfi_range,
      revisionId: row.revision_id,
      anchorStatus: row.anchor_status,
      originalCfi: row.original_cfi,
      originalChapterRef: row.original_chapter_ref,
      originalSelectedText: row.original_selected_text,
    })),
    ...comments.map((row): EpubExportAnnotation => ({
      id: row.id,
      type: 'comment',
      body: row.body,
      selectedText: row.selected_text,
      chapterRef: row.chapter_ref,
      cfi: row.cfi_range,
      revisionId: row.revision_id,
      anchorStatus: row.anchor_status,
      originalCfi: row.original_cfi,
      originalChapterRef: row.original_chapter_ref,
      originalSelectedText: row.original_selected_text,
      parentCommentId: row.parent_comment_id,
    })),
    ...bookmarks.map(bookmarkAnnotation),
  ];
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  let value = '';
  for (const byte of digest) value += byte.toString(16).padStart(2, '0');
  return value;
}

async function readRunnerResponse(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > MAX_RUNNER_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new EpubAnnotationExportFailure(
          'EPUBCHECK_INVALID_RESPONSE',
          'The EPUBCheck runner response exceeded its size limit',
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof EpubAnnotationExportFailure) throw error;
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner response could not be read',
    );
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseRunnerJson(bytes: Uint8Array): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError();
    return parsed as Record<string, unknown>;
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned malformed JSON',
    );
  }
}

async function validateWithEpubCheck(env: Env, epub: Uint8Array<ArrayBuffer>): Promise<void> {
  if (!env.EPUBCHECK_RUNNER_URL || !env.EPUBCHECK_RUNNER_TOKEN) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner is not configured',
    );
  }

  let endpoint: URL;
  try {
    endpoint = getValidatedRunnerUrl(env.EPUBCHECK_RUNNER_URL);
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner URL is invalid',
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.EPUBCHECK_RUNNER_TOKEN}`,
        'content-type': 'application/epub+zip',
        'content-length': String(epub.byteLength),
      },
      body: epub,
      signal: AbortSignal.timeout(RUNNER_TIMEOUT_MS),
    });
  } catch {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner could not be reached',
    );
  }

  if (!response.ok && response.status !== 422) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_UNAVAILABLE',
      'The EPUBCheck runner did not accept the request',
    );
  }
  const raw = parseRunnerJson(await readRunnerResponse(response));
  if (raw.safetyStatus === 'rejected') {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_REJECTED',
      'The generated EPUB failed archive safety validation',
    );
  }
  if (raw.conformanceStatus !== 'completed') {
    throw new EpubAnnotationExportFailure(
      raw.conformanceStatus === 'failed' ? 'EPUBCHECK_REJECTED' : 'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner did not report successful conformance',
    );
  }
  if (!response.ok || raw.safetyStatus !== 'accepted') {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned an unexpected validation status',
    );
  }

  const result = EpubRunnerResultSchema.safeParse(raw);
  if (!result.success) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INVALID_RESPONSE',
      'The EPUBCheck runner returned a malformed validation result',
    );
  }
  if (result.data.sha256 !== (await sha256Hex(epub))) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_INTEGRITY_ERROR',
      'The EPUBCheck runner validated different bytes',
    );
  }
  if (result.data.findings.some((finding) => finding.severity === 'error')) {
    throw new EpubAnnotationExportFailure(
      'EPUBCHECK_REJECTED',
      'The generated EPUB has EPUBCheck error findings',
    );
  }
}

export async function createValidatedAnnotationEpub(
  env: Env,
  bookId: string,
  userEmail: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const revision = await queryFirst<SourceRevisionRow>(
    env,
    `SELECT id, storage_key, file_size_bytes FROM book_files
     WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [bookId],
  );
  if (!revision) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_NOT_FOUND',
      'No EPUB revision is available for this book',
    );
  }
  if (
    !revision.id ||
    !revision.storage_key ||
    !Number.isSafeInteger(revision.file_size_bytes) ||
    revision.file_size_bytes <= 0
  ) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision metadata is invalid',
    );
  }
  if (revision.file_size_bytes > EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes) {
    throw new EpubAnnotationExportError(
      'SOURCE_TOO_LARGE',
      'The source EPUB exceeds the 8 MiB limit',
    );
  }

  const annotations = await readUserAnnotations(env, bookId, userEmail);
  let object: R2ObjectBody | null;
  try {
    object = await env.BOOKS_BUCKET.get(revision.storage_key);
  } catch {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision could not be read',
    );
  }
  if (!object || object.size !== revision.file_size_bytes) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision size does not match its stored metadata',
    );
  }

  let sourceBytes: Uint8Array;
  try {
    sourceBytes = new Uint8Array(await object.arrayBuffer());
  } catch {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision could not be read',
    );
  }
  if (sourceBytes.byteLength !== revision.file_size_bytes) {
    throw new EpubAnnotationExportFailure(
      'SOURCE_UNAVAILABLE',
      'The latest EPUB revision changed while it was being read',
    );
  }

  const epub = await exportAnnotationsToEpub(sourceBytes, annotations, { revisionId: revision.id });
  await validateWithEpubCheck(env, epub);
  return epub;
}
