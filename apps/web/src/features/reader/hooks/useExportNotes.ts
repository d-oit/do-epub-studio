import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AnnotationLocator } from '@do-epub-studio/shared';
import { useReaderStore } from '../../../stores';
import type { Bookmark, Comment, Highlight } from '../../../stores/reader';

export const NOTES_FORMAT_VERSION = 1 as const;
export const NOTES_MIME_TYPE = 'text/markdown' as const;

export interface ExportedAnnotationBase {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedHighlight extends ExportedAnnotationBase {
  type: 'highlight';
  selectedText: string;
  color: string;
  note: string | null;
  locator: AnnotationLocator | null;
}

export interface ExportedComment extends ExportedAnnotationBase {
  type: 'comment';
  body: string;
  status: 'open' | 'resolved' | 'deleted';
  visibility: 'shared' | 'internal' | 'resolved';
  parentCommentId: string | null;
  selectedText: string | null;
  locator: AnnotationLocator | null;
}

export interface ExportedBookmark extends ExportedAnnotationBase {
  type: 'bookmark';
  label: string | null;
  locator: AnnotationLocator;
}

export type ExportedAnnotation = ExportedHighlight | ExportedComment | ExportedBookmark;

export interface NotesExport {
  format: 'do-epub-studio-notes';
  version: typeof NOTES_FORMAT_VERSION;
  exportedAt: string;
  bookTitle: string;
  bookId: string | null;
  annotations: ExportedAnnotation[];
}

export interface NotesImportResult {
  ok: boolean;
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
  skipped: number;
  errors: string[];
}

function highlightToExported(h: Highlight): ExportedHighlight {
  return {
    type: 'highlight',
    id: h.id,
    selectedText: h.selectedText,
    color: h.color,
    note: h.note,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    locator: h.cfiRange
      ? { cfi: h.cfiRange, selectedText: h.selectedText, chapterRef: h.chapterRef ?? undefined }
      : null,
  };
}

function commentToExported(c: Comment): ExportedComment {
  return {
    type: 'comment',
    id: c.id,
    body: c.body,
    status: c.status,
    visibility: c.visibility,
    parentCommentId: c.parentCommentId,
    selectedText: c.selectedText,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    locator: c.cfiRange
      ? { cfi: c.cfiRange, selectedText: c.selectedText ?? undefined, chapterRef: c.chapterRef ?? undefined }
      : null,
  };
}

function bookmarkToExported(b: Bookmark): ExportedBookmark {
  return {
    type: 'bookmark',
    id: b.id,
    label: b.label,
    createdAt: b.createdAt,
    updatedAt: b.createdAt,
    locator: b.locator,
  };
}

export function buildNotesExport(params: {
  bookTitle: string;
  bookId: string | null;
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
}): NotesExport {
  const { bookTitle, bookId, highlights, comments, bookmarks } = params;
  return {
    format: 'do-epub-studio-notes',
    version: NOTES_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    bookTitle,
    bookId,
    annotations: [
      ...highlights.map(highlightToExported),
      ...comments.filter((c) => c.status !== 'deleted').map(commentToExported),
      ...bookmarks.map(bookmarkToExported),
    ],
  };
}

export function notesExportToMarkdown(payload: NotesExport): string {
  const header = [
    `# ${payload.bookTitle || 'Book'} - Exported Notes`,
    '',
    `<!-- format: ${payload.format} v${payload.version} -->`,
    `<!-- exportedAt: ${payload.exportedAt} -->`,
    payload.bookId ? `<!-- bookId: ${payload.bookId} -->` : '',
    '',
  ].filter(Boolean);

  const sections: string[] = [];
  const highlights = payload.annotations.filter((a): a is ExportedHighlight => a.type === 'highlight');
  const comments = payload.annotations.filter((a): a is ExportedComment => a.type === 'comment');
  const bookmarks = payload.annotations.filter((a): a is ExportedBookmark => a.type === 'bookmark');

  if (highlights.length > 0) {
    sections.push('## Highlights', '');
    sections.push(
      ...highlights.map((h) => {
        const cfi = h.locator?.cfi ? ` [${h.locator.cfi}]` : '';
        const chapter = h.locator?.chapterRef ? ` (${h.locator.chapterRef})` : '';
        const note = h.note ? ` — ${h.note}` : '';
        return `- "${h.selectedText}"${cfi}${chapter} (${h.color})${note}`;
      }),
      '',
    );
  }

  if (bookmarks.length > 0) {
    sections.push('## Bookmarks', '');
    sections.push(
      ...bookmarks.map((b) => {
        const cfi = b.locator.cfi ? ` [${b.locator.cfi}]` : '';
        const chapter = b.locator.chapterRef ? ` (${b.locator.chapterRef})` : '';
        const label = b.label ? ` — ${b.label}` : '';
        return `- ${b.locator.selectedText ?? 'Untitled'}${cfi}${chapter}${label}`;
      }),
      '',
    );
  }

  if (comments.length > 0) {
    sections.push('## Comments', '');
    sections.push(
      ...comments.map((c) => {
        const cfi = c.locator?.cfi ? ` [${c.locator.cfi}]` : '';
        const quote = c.selectedText ? ` — "${c.selectedText.slice(0, 80)}${c.selectedText.length > 80 ? '...' : ''}"` : '';
        return `- ${c.body}${cfi}${quote}`;
      }),
      '',
    );
  }

  if (sections.length === 0) {
    sections.push('_No annotations to export._', '');
  }

  return [...header, ...sections].join('\n');
}

function parseNotesMarkdown(markdown: string): NotesExport | null {
  const formatMatch = markdown.match(/<!--\s*format:\s*(do-epub-studio-notes)\s+v(\d+)\s*-->/);
  if (!formatMatch) return null;
  const version = formatMatch[2] === '1' ? NOTES_FORMAT_VERSION : null;
  if (version === null) return null;

  const exportedAtMatch = markdown.match(/<!--\s*exportedAt:\s*([^>]+?)\s*-->/);
  const bookIdMatch = markdown.match(/<!--\s*bookId:\s*([^>]+?)\s*-->/);
  const titleMatch = markdown.match(/^#\s+(.+?)\s+- Exported Notes\s*$/m);

  const annotations: ExportedAnnotation[] = [];

  const lines = markdown.split('\n');
  let inHighlights = false;
  let inBookmarks = false;
  let inComments = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '## Highlights') {
      inHighlights = true;
      inBookmarks = false;
      inComments = false;
      continue;
    }
    if (line === '## Bookmarks') {
      inHighlights = false;
      inBookmarks = true;
      inComments = false;
      continue;
    }
    if (line === '## Comments') {
      inHighlights = false;
      inBookmarks = false;
      inComments = true;
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      inHighlights = false;
      inBookmarks = false;
      inComments = false;
      continue;
    }
    if (!line.startsWith('- ')) continue;

    const cfiMatch = line.match(/\[(epubcfi\([^)]+\))\]/);
    const cfi = cfiMatch?.[1];

    if (inHighlights) {
      const m = line.match(/^- "?(.+?)"?\s*(?:\[(epubcfi\([^)]+\))\])?\s*(?:\(([^)]+)\))?\s*\((#[0-9a-fA-F]{3,8})\)\s*(?:—\s*(.+))?$/);
      if (m) {
        const [, selectedText, matchedCfi, chapterRef, color, note] = m;
        annotations.push({
          type: 'highlight',
          id: `imported-h-${annotations.length}`,
          selectedText: selectedText ?? '',
          color: color ?? '#ffeb3b',
          note: note ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: matchedCfi ?? cfi
            ? { cfi: matchedCfi ?? cfi, selectedText, chapterRef: chapterRef ?? undefined }
            : null,
        });
      }
    } else if (inBookmarks) {
      const m = line.match(/^- "?(.+?)"?\s*(?:\[(epubcfi\([^)]+\))\])?\s*(?:\(([^)]+)\))?\s*(?:—\s*(.+))?$/);
      if (m) {
        const [, selectedText, matchedCfi, chapterRef, label] = m;
        annotations.push({
          type: 'bookmark',
          id: `imported-b-${annotations.length}`,
          label: label ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: {
            cfi: matchedCfi ?? cfi,
            selectedText: selectedText ?? undefined,
            chapterRef: chapterRef ?? undefined,
          },
        });
      }
    } else if (inComments) {
      const m = line.match(/^- "?(.+?)"?\s*(?:\[(epubcfi\([^)]+\))\])?\s*(?:—\s*"?(.+?)"?\s*)?$/);
      if (m) {
        const [, body, matchedCfi, quote] = m;
        annotations.push({
          type: 'comment',
          id: `imported-c-${annotations.length}`,
          body: body ?? '',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          selectedText: quote ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: matchedCfi ?? cfi
            ? { cfi: matchedCfi ?? cfi, selectedText: quote ?? undefined }
            : null,
        });
      }
    }
  }

  return {
    format: 'do-epub-studio-notes',
    version: NOTES_FORMAT_VERSION,
    exportedAt: exportedAtMatch?.[1] ?? new Date().toISOString(),
    bookTitle: titleMatch?.[1] ?? 'Imported Book',
    bookId: bookIdMatch?.[1] ?? null,
    annotations,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function exportedToEntities(payload: NotesExport): {
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
  skipped: number;
  errors: string[];
} {
  const highlights: Highlight[] = [];
  const comments: Comment[] = [];
  const bookmarks: Bookmark[] = [];
  let skipped = 0;
  const errors: string[] = [];
  const now = nowIso();

  for (const ann of payload.annotations) {
    try {
      if (ann.type === 'highlight') {
        highlights.push({
          id: ann.id,
          chapterRef: ann.locator?.chapterRef ?? null,
          cfiRange: ann.locator?.cfi ?? null,
          selectedText: ann.selectedText,
          note: ann.note,
          color: ann.color,
          createdAt: ann.createdAt || now,
          updatedAt: ann.updatedAt || now,
        });
      } else if (ann.type === 'comment') {
        comments.push({
          id: ann.id,
          userEmail: 'imported@local',
          chapterRef: ann.locator?.chapterRef ?? null,
          cfiRange: ann.locator?.cfi ?? null,
          selectedText: ann.selectedText,
          body: ann.body,
          status: ann.status,
          visibility: ann.visibility,
          parentCommentId: ann.parentCommentId,
          createdAt: ann.createdAt || now,
          updatedAt: ann.updatedAt || now,
          resolvedAt: null,
        });
      } else if (ann.type === 'bookmark') {
        if (!ann.locator.cfi && !ann.locator.selectedText) {
          skipped += 1;
          errors.push(`bookmark ${ann.id} has no locator (cfi or text)`);
          continue;
        }
        bookmarks.push({
          id: ann.id,
          locator: ann.locator,
          label: ann.label,
          createdAt: ann.createdAt || now,
        });
      }
    } catch (e) {
      skipped += 1;
      errors.push(`failed to import ${ann.type} ${ann.id}: ${(e as Error).message}`);
    }
  }

  return { highlights, comments, bookmarks, skipped, errors };
}

export function importNotesFromMarkdown(markdown: string): NotesImportResult {
  const payload = parseNotesMarkdown(markdown);
  if (!payload) {
    return {
      ok: false,
      highlights: [],
      comments: [],
      bookmarks: [],
      skipped: 0,
      errors: ['Unrecognized notes format — expected `<!-- format: do-epub-studio-notes v1 -->` header.'],
    };
  }
  const entities = exportedToEntities(payload);
  return {
    ok: entities.errors.length === 0,
    ...entities,
  };
}

export function parseExportFilename(bookTitle: string | null | undefined): string {
  const safe = (bookTitle || 'notes').replace(/[\\/:*?"<>|]+/g, '_');
  return `${safe}-notes.md`;
}

interface UseExportNotesReturn {
  handleExportNotes: (bookTitle: string | null | undefined) => void;
}

export function useExportNotes(): UseExportNotesReturn {
  const { highlights, comments, bookmarks } = useReaderStore(
    useShallow((s) => ({
      highlights: s.highlights,
      comments: s.comments,
      bookmarks: s.bookmarks,
    })),
  );

  const handleExportNotes = useCallback(
    (bookTitle: string | null | undefined) => {
      const payload = buildNotesExport({
        bookTitle: bookTitle ?? 'Book',
        bookId: null,
        highlights,
        comments,
        bookmarks,
      });
      const markdown = notesExportToMarkdown(payload);
      const blob = new Blob([markdown], { type: NOTES_MIME_TYPE });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = parseExportFilename(bookTitle);
      a.click();
      URL.revokeObjectURL(url);
    },
    [highlights, comments, bookmarks],
  );

  return { handleExportNotes };
}
