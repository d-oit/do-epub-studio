import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { matchBounded } from '@do-epub-studio/shared/src/safe-regex';
import type { AnnotationLocator } from '@do-epub-studio/shared/src/schemas';
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

interface ParsedHighlight {
  selectedText: string;
  color: string;
  note: string | null;
  cfi: string | null;
  chapterRef: string | undefined;
}

interface ParsedBookmark {
  selectedText: string;
  label: string | null;
  cfi: string | null;
  chapterRef: string | undefined;
}

interface ParsedComment {
  body: string;
  quote: string | null;
  cfi: string | null;
}

function findCfiInBrackets(text: string): string | null {
  const markerIdx = text.indexOf('[epubcfi(');
  if (markerIdx < 0) return null;
  let depth = 1;
  let i = markerIdx + '[epubcfi('.length;
  while (i < text.length && depth > 0) {
    const ch = text.charAt(i);
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  const close = i - 1;
  const inside = text.slice(markerIdx + 1, close);
  if (inside.length > 600 || !inside.startsWith('epubcfi(') || !inside.endsWith(')')) {
    return null;
  }
  return inside;
}

function findChapterInParens(text: string): string | null {
  const open = text.indexOf('(');
  if (open < 0) return null;
  const close = text.indexOf(')', open + 1);
  if (close < 0 || close - open - 1 > 255) return null;
  const inside = text.slice(open + 1, close);
  if (inside.startsWith('#')) return null;
  return inside;
}

function findNoteAfterDash(text: string): string | null {
  const idx = text.indexOf('— ');
  if (idx < 0) return null;
  return text.slice(idx + 2);
}

function parseHighlightLine(line: string, fallbackCfi: string | undefined): ParsedHighlight | null {
  if (!line.startsWith('- ')) return null;
  let rest = line.slice(2);
  if (rest.length > 4096) return null;
  if (rest.startsWith('"')) rest = rest.slice(1);
  const closingQuote = rest.indexOf('" [');
  if (closingQuote >= 0) rest = rest.slice(0, closingQuote) + rest.slice(closingQuote + 1);
  else if (rest.endsWith('"')) rest = rest.slice(0, -1);

  const cfi = findCfiInBrackets(rest);
  if (cfi) {
    const start = rest.indexOf('[epubcfi(');
    let depth = 1;
    let i = start + '[epubcfi('.length;
    while (i < rest.length && depth > 0) {
      const ch = rest[i];
      if (ch === '[') depth += 1;
      else if (ch === ']') depth -= 1;
      i += 1;
    }
    rest = rest.slice(0, start) + rest.slice(i);
  }

  const chapterRef = findChapterInParens(rest) ?? undefined;
  if (chapterRef !== undefined) {
    const open = rest.indexOf('(');
    const close = rest.indexOf(')', open) + 1;
    rest = rest.slice(0, open) + rest.slice(close);
  }

  const colorMatch = rest.match(/\((#[0-9a-fA-F]{3,8})\)/);
  const color = colorMatch?.[1] ?? '#ffeb3b';
  if (colorMatch) {
    const open = rest.indexOf(colorMatch[0]);
    rest = rest.slice(0, open) + rest.slice(open + colorMatch[0].length);
  }

  const note = findNoteAfterDash(rest);
  const selectedText = (note ? rest.slice(0, rest.indexOf('— ')).trim() : rest.trim()).slice(0, 2048);
  if (selectedText.length === 0) return null;

  return {
    selectedText,
    color,
    note,
    cfi: cfi ?? fallbackCfi ?? null,
    chapterRef,
  };
}

function parseBookmarkLine(line: string, fallbackCfi: string | undefined): ParsedBookmark | null {
  if (!line.startsWith('- ')) return null;
  let rest = line.slice(2);
  if (rest.length > 4096) return null;
  if (rest.startsWith('"')) rest = rest.slice(1);
  const closingQuote = rest.indexOf('" [');
  if (closingQuote >= 0) rest = rest.slice(0, closingQuote) + rest.slice(closingQuote + 1);
  else if (rest.endsWith('"')) rest = rest.slice(0, -1);

  const cfi = findCfiInBrackets(rest);
  if (cfi) {
    const start = rest.indexOf('[epubcfi(');
    let depth = 1;
    let i = start + '[epubcfi('.length;
    while (i < rest.length && depth > 0) {
      const ch = rest[i];
      if (ch === '[') depth += 1;
      else if (ch === ']') depth -= 1;
      i += 1;
    }
    rest = rest.slice(0, start) + rest.slice(i);
  }

  const chapterRef = findChapterInParens(rest) ?? undefined;
  if (chapterRef !== undefined) {
    const open = rest.indexOf('(');
    const close = rest.indexOf(')', open) + 1;
    rest = rest.slice(0, open) + rest.slice(close);
  }

  const label = findNoteAfterDash(rest);
  const selectedText = (label ? rest.slice(0, rest.indexOf('— ')).trim() : rest.trim()).slice(0, 2048);
  if (selectedText.length === 0) return null;

  return {
    selectedText,
    label,
    cfi: cfi ?? fallbackCfi ?? null,
    chapterRef,
  };
}

function parseCommentLine(line: string, fallbackCfi: string | undefined): ParsedComment | null {
  if (!line.startsWith('- ')) return null;
  let rest = line.slice(2);
  if (rest.length > 4096) return null;

  const cfi = findCfiInBrackets(rest);
  if (cfi) {
    const start = rest.indexOf('[epubcfi(');
    let depth = 1;
    let i = start + '[epubcfi('.length;
    while (i < rest.length && depth > 0) {
      const ch = rest[i];
      if (ch === '[') depth += 1;
      else if (ch === ']') depth -= 1;
      i += 1;
    }
    rest = rest.slice(0, start) + rest.slice(i);
  }

  const noteIdx = rest.indexOf('— "');
  let body = rest;
  let quote: string | null = null;
  if (noteIdx >= 0) {
    body = rest.slice(0, noteIdx).trim();
    const after = rest.slice(noteIdx + 3);
    const close = after.lastIndexOf('"');
    if (close > 0) {
      quote = after.slice(0, close).slice(0, 2048);
    } else {
      quote = after.slice(0, 2048);
    }
  }
  if (body.length === 0) return null;

  return {
    body: body.slice(0, 2048),
    quote,
    cfi: cfi ?? fallbackCfi ?? null,
  };
}

function parseNotesMarkdown(markdown: string): NotesExport | null {
  const MAX_HEADER = 512;
  const formatMatch = matchBounded(
    /<!--\s*format:\s*(do-epub-studio-notes)\s+v(\d+)\s*-->/,
    markdown,
    MAX_HEADER,
  );
  if (!formatMatch) return null;
  if (formatMatch[2] !== '1') return null;

  const exportedAtMatch = matchBounded(
    /<!--\s*exportedAt:\s*([^>]+?)\s*-->/,
    markdown,
    MAX_HEADER,
  );
  const bookIdMatch = matchBounded(
    /<!--\s*bookId:\s*([^>]+?)\s*-->/,
    markdown,
    MAX_HEADER,
  );
  const titleMatch = matchBounded(
    /^#\s+(.+?)\s+- Exported Notes\s*$/m,
    markdown,
    1024,
  );

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
    if (line.length > 4096) continue;

    const cfiMatch = matchBounded(
      /\[(epubcfi\([^)]{1,512}\))\]/,
      line,
      4096,
    );
    const cfi = cfiMatch?.[1];

    if (inHighlights) {
      const parsed = parseHighlightLine(line, cfi);
      if (parsed) {
        annotations.push({
          type: 'highlight',
          id: `imported-h-${annotations.length}`,
          selectedText: parsed.selectedText,
          color: parsed.color,
          note: parsed.note,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: parsed.cfi
            ? { cfi: parsed.cfi, selectedText: parsed.selectedText, chapterRef: parsed.chapterRef }
            : null,
        });
      }
    } else if (inBookmarks) {
      const parsed = parseBookmarkLine(line, cfi);
      if (parsed) {
        annotations.push({
          type: 'bookmark',
          id: `imported-b-${annotations.length}`,
          label: parsed.label,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: {
            cfi: parsed.cfi ?? '',
            selectedText: parsed.selectedText,
            chapterRef: parsed.chapterRef,
          },
        });
      }
    } else if (inComments) {
      const parsed = parseCommentLine(line, cfi);
      if (parsed) {
        annotations.push({
          type: 'comment',
          id: `imported-c-${annotations.length}`,
          body: parsed.body,
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          selectedText: parsed.quote ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locator: parsed.cfi
            ? { cfi: parsed.cfi, selectedText: parsed.quote ?? undefined }
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
      switch (ann.type) {
        case 'highlight':
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
          break;
        case 'comment':
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
          break;
        case 'bookmark':
          if (!ann.locator.cfi && !ann.locator.selectedText) {
            skipped += 1;
            errors.push(`bookmark ${ann.id} has no locator (cfi or text)`);
            break;
          }
          bookmarks.push({
            id: ann.id,
            locator: ann.locator,
            label: ann.label,
            createdAt: ann.createdAt || now,
          });
          break;
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
