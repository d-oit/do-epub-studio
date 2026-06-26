import { describe, it, expect } from 'vitest';
import {
  buildNotesExport,
  notesExportToMarkdown,
  importNotesFromMarkdown,
  NOTES_FORMAT_VERSION,
} from '../features/reader/hooks/useExportNotes';

describe('notes round-trip', () => {
  it('serializes locator/cfi/chapter in markdown', () => {
    const payload = buildNotesExport({
      bookTitle: 'Test Book',
      bookId: 'b1',
      highlights: [
        {
          id: 'h1',
          chapterRef: 'ch1.xhtml',
          cfiRange: 'epubcfi(/6/4[chap01ref]!/4/2/1:0)',
          selectedText: 'highlighted text',
          note: 'My note',
          color: '#ff0000',
          createdAt: '2026-06-24T00:00:00.000Z',
          updatedAt: '2026-06-24T00:00:00.000Z',
        },
      ],
      comments: [
        {
          id: 'c1',
          userEmail: 'a@b.com',
          chapterRef: 'ch1.xhtml',
          cfiRange: 'epubcfi(/6/4!/4/2/3:0)',
          selectedText: 'some text',
          body: 'Great point!',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          createdAt: '2026-06-24T00:00:00.000Z',
          updatedAt: '2026-06-24T00:00:00.000Z',
          resolvedAt: null,
        },
      ],
      bookmarks: [
        {
          id: 'b1',
          locator: {
            cfi: 'epubcfi(/6/4!/4/10/2:0)',
            selectedText: 'bookmark text',
            chapterRef: 'ch2.xhtml',
          },
          label: 'Important',
          createdAt: '2026-06-24T00:00:00.000Z',
        },
      ],
    });

    expect(payload.version).toBe(NOTES_FORMAT_VERSION);
    expect(payload.annotations).toHaveLength(3);

    const md = notesExportToMarkdown(payload);
    expect(md).toContain('<!-- format: do-epub-studio-notes v1 -->');
    expect(md).toContain('epubcfi(/6/4[chap01ref]!/4/2/1:0)');
    expect(md).toContain('(ch1.xhtml)');
    expect(md).toContain('epubcfi(/6/4!/4/10/2:0)');
    expect(md).toContain('(ch2.xhtml)');
    expect(md).toContain('## Highlights');
    expect(md).toContain('## Bookmarks');
    expect(md).toContain('## Comments');
  });

  it('round-trips a payload via markdown', () => {
    const payload = buildNotesExport({
      bookTitle: 'Test Book',
      bookId: 'b1',
      highlights: [
        {
          id: 'h1',
          chapterRef: 'ch1.xhtml',
          cfiRange: 'epubcfi(/6/4!/4/2/1:0)',
          selectedText: 'highlighted text',
          note: 'My note',
          color: '#ff0000',
          createdAt: '2026-06-24T00:00:00.000Z',
          updatedAt: '2026-06-24T00:00:00.000Z',
        },
      ],
      comments: [
        {
          id: 'c1',
          userEmail: 'a@b.com',
          chapterRef: 'ch1.xhtml',
          cfiRange: 'epubcfi(/6/4!/4/2/3:0)',
          selectedText: 'some text',
          body: 'Great point!',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          createdAt: '2026-06-24T00:00:00.000Z',
          updatedAt: '2026-06-24T00:00:00.000Z',
          resolvedAt: null,
        },
      ],
      bookmarks: [
        {
          id: 'b1',
          locator: {
            cfi: 'epubcfi(/6/4!/4/10/2:0)',
            selectedText: 'bookmark text',
            chapterRef: 'ch2.xhtml',
          },
          label: 'Important',
          createdAt: '2026-06-24T00:00:00.000Z',
        },
      ],
    });

    const md = notesExportToMarkdown(payload);
    const imported = importNotesFromMarkdown(md);

    expect(imported.ok).toBe(true);
    expect(imported.errors).toEqual([]);
    expect(imported.highlights).toHaveLength(1);
    expect(imported.highlights[0]?.cfiRange).toBe('epubcfi(/6/4!/4/2/1:0)');
    expect(imported.highlights[0]?.chapterRef).toBe('ch1.xhtml');
    expect(imported.highlights[0]?.selectedText).toBe('highlighted text');
    expect(imported.comments).toHaveLength(1);
    expect(imported.comments[0]?.body).toBe('Great point!');
    expect(imported.bookmarks).toHaveLength(1);
    expect(imported.bookmarks[0]?.label).toBe('Important');
    expect(imported.bookmarks[0]?.locator.cfi).toBe('epubcfi(/6/4!/4/10/2:0)');
    expect(imported.bookmarks[0]?.locator.chapterRef).toBe('ch2.xhtml');
  });

  it('returns an error for unrecognized format', () => {
    const result = importNotesFromMarkdown('# Some random markdown\n\nJust text.\n');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognized notes format');
  });

  it('skips bookmark without locator', () => {
    const malformed = [
      '<!-- format: do-epub-studio-notes v1 -->',
      '## Bookmarks',
      '- ',
      '',
    ].join('\n');
    const result = importNotesFromMarkdown(malformed);
    expect(result.bookmarks).toHaveLength(0);
  });
});
