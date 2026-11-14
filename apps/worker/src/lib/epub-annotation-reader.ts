import {
  EPUB_ANNOTATION_EXPORT_LIMITS,
  EpubAnnotationExportError,
  type EpubExportAnnotation,
} from '@do-epub-studio/reader-core/packager';
import { queryAll, queryFirst } from '../db/client';
import type { Env, JsonRow } from './env';

const MAX_ANNOTATIONS = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotations;
const MAX_ANNOTATION_TEXT_BYTES = EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotationTextBytes;

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
  const fallback: EpubExportAnnotation = {
    id: row.id,
    type: 'bookmark',
    body: '',
    label: row.label,
    locatorContext: row.locator_json,
  };
  let locator: unknown;
  try {
    locator = JSON.parse(row.locator_json) as unknown;
  } catch {
    return fallback;
  }
  if (!locator || typeof locator !== 'object' || Array.isArray(locator)) {
    return fallback;
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

export async function readUserAnnotations(
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
