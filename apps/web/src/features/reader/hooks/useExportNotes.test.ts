import { describe, it, expect } from 'vitest';
import {
  buildNotesExport,
  notesExportToMarkdown,
  importNotesFromMarkdown,
  parseExportFilename,
  NOTES_FORMAT_VERSION,
  NOTES_MIME_TYPE,
  type NotesExport,
} from './useExportNotes';

describe('useExportNotes — constants', () => {
  it('NOTES_FORMAT_VERSION is 1', () => {
    expect(NOTES_FORMAT_VERSION).toBe(1);
  });

  it('NOTES_MIME_TYPE is text/markdown', () => {
    expect(NOTES_MIME_TYPE).toBe('text/markdown');
  });
});

describe('useExportNotes — buildNotesExport', () => {
  it('creates export with correct format and version', () => {
    const result = buildNotesExport({
      bookTitle: 'Test Book',
      bookId: 'book-1',
      highlights: [],
      comments: [],
      bookmarks: [],
    });

    expect(result.format).toBe('do-epub-studio-notes');
    expect(result.version).toBe(1);
    expect(result.bookTitle).toBe('Test Book');
    expect(result.bookId).toBe('book-1');
    expect(result.annotations).toEqual([]);
  });

  it('includes highlights, comments, and bookmarks', () => {
    const result = buildNotesExport({
      bookTitle: 'Book',
      bookId: null,
      highlights: [
        { id: 'h1', selectedText: 'text', color: '#ff0000', note: null, chapterRef: null, cfiRange: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
      comments: [
        { id: 'c1', userEmail: 'u@e.com', body: 'body', status: 'open', visibility: 'shared', parentCommentId: null, selectedText: null, chapterRef: null, cfiRange: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', resolvedAt: null },
      ],
      bookmarks: [
        { id: 'b1', locator: { cfi: 'cfi', selectedText: 'text' }, label: 'mark', createdAt: '2026-01-01' },
      ],
    });

    expect(result.annotations).toHaveLength(3);
    expect(result.annotations[0].type).toBe('highlight');
    expect(result.annotations[1].type).toBe('comment');
    expect(result.annotations[2].type).toBe('bookmark');
  });

  it('filters out deleted comments', () => {
    const result = buildNotesExport({
      bookTitle: 'Book',
      bookId: null,
      highlights: [],
      comments: [
        { id: 'c1', userEmail: 'u@e.com', body: 'open', status: 'open', visibility: 'shared', parentCommentId: null, selectedText: null, chapterRef: null, cfiRange: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', resolvedAt: null },
        { id: 'c2', userEmail: 'u@e.com', body: 'deleted', status: 'deleted', visibility: 'shared', parentCommentId: null, selectedText: null, chapterRef: null, cfiRange: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', resolvedAt: null },
      ],
      bookmarks: [],
    });

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].type).toBe('comment');
  });
});

describe('useExportNotes — notesExportToMarkdown', () => {
  it('generates markdown with header and sections', () => {
    const exportData: NotesExport = {
      format: 'do-epub-studio-notes',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      bookTitle: 'My Book',
      bookId: 'book-1',
      annotations: [
        { type: 'highlight', id: 'h1', selectedText: 'hello', color: '#ff0000', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', locator: null },
      ],
    };

    const md = notesExportToMarkdown(exportData);

    expect(md).toContain('# My Book - Exported Notes');
    expect(md).toContain('## Highlights');
    expect(md).toContain('"hello"');
  });

  it('generates empty message when no annotations', () => {
    const exportData: NotesExport = {
      format: 'do-epub-studio-notes',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      bookTitle: 'Book',
      bookId: null,
      annotations: [],
    };

    const md = notesExportToMarkdown(exportData);

    expect(md).toContain('_No annotations to export._');
  });
});

describe('useExportNotes — importNotesFromMarkdown', () => {
  it('returns error for unrecognized format', () => {
    const result = importNotesFromMarkdown('# Just a plain markdown');

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognized notes format');
  });

  it('imports highlights from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->
<!-- exportedAt: 2026-01-01T00:00:00Z -->

## Highlights

- "important text" (#ff0000)
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].selectedText).toMatch(/^important text/);
  });

  it('imports bookmarks from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->

## Bookmarks

- "bookmark text" — my label
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].label).toBe('my label');
  });

  it('imports comments from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->

## Comments

- This is my comment — "quoted text"
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].body).toBe('This is my comment');
  });
});

describe('useExportNotes — parseExportFilename', () => {
  it('returns sanitized filename', () => {
    expect(parseExportFilename('My Book')).toBe('My Book-notes.md');
  });

  it('replaces unsafe characters', () => {
    expect(parseExportFilename('Book/With:Special*Chars')).toBe('Book_With_Special_Chars-notes.md');
  });

  it('uses fallback for null title', () => {
    expect(parseExportFilename(null)).toBe('notes-notes.md');
  });

  it('uses fallback for undefined title', () => {
    expect(parseExportFilename(undefined)).toBe('notes-notes.md');
  });
});
