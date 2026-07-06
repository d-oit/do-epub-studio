import { matchBounded } from '@do-epub-studio/shared';
import type { NotesExport, ExportedAnnotation } from '../hooks/useExportNotes';
import { NOTES_FORMAT_VERSION } from '../hooks/useExportNotes';

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

function removeCfiFromText(rest: string, cfi: string): { text: string; cfiFound: string | null } {
  const start = rest.indexOf('[epubcfi(');
  if (start < 0) return { text: rest, cfiFound: null };
  let depth = 1;
  let i = start + '[epubcfi('.length;
  while (i < rest.length && depth > 0) {
    const ch = rest[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    i += 1;
  }
  return { text: rest.slice(0, start) + rest.slice(i), cfiFound: cfi };
}

function removeChapterFromText(rest: string, chapterRef: string | undefined): string {
  if (chapterRef === undefined) return rest;
  const open = rest.indexOf('(');
  const close = rest.indexOf(')', open) + 1;
  return rest.slice(0, open) + rest.slice(close);
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
    const result = removeCfiFromText(rest, cfi);
    rest = result.text;
  }

  const chapterRef = findChapterInParens(rest) ?? undefined;
  rest = removeChapterFromText(rest, chapterRef);

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
    const result = removeCfiFromText(rest, cfi);
    rest = result.text;
  }

  const chapterRef = findChapterInParens(rest) ?? undefined;
  rest = removeChapterFromText(rest, chapterRef);

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
    const result = removeCfiFromText(rest, cfi);
    rest = result.text;
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

export function parseNotesMarkdown(markdown: string): NotesExport | null {
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
