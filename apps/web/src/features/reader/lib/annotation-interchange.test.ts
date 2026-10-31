import { describe, expect, it } from 'vitest';
import { parseNotesMarkdown } from './export-notes-markdown';
import {
  buildAnnotationInterchange,
  parseAnnotationInterchange,
  publicationIdentity,
} from './annotation-interchange';

const state = {
  highlights: [
    {
      id: 'h-1',
      chapterRef: 'chapter.xhtml',
      cfiRange: 'epubcfi(/6/4!/4/2:3)',
      selectedText: 'quoted text',
      note: 'note',
      color: '#ffff00',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  bookmarks: [
    {
      id: 'b-1',
      locator: {
        cfi: 'epubcfi(/6/4)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'bookmark quote',
      },
      label: 'bookmark',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  comments: [
    {
      id: 'c-1',
      displayName: '',
      isOwn: true,
      chapterRef: 'chapter.xhtml',
      cfiRange: 'epubcfi(/6/4)',
      selectedText: 'comment quote',
      body: '<script>alert(1)</script>',
      status: 'open' as const,
      visibility: 'internal' as const,
      parentCommentId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      resolvedAt: null,
    },
  ],
};

const exportText = () =>
  JSON.stringify(
    buildAnnotationInterchange({ bookId: 'book-1', bookTitle: 'Synthetic title', state }),
  );

describe('EPUB Annotations 1.0 Working Draft interchange', () => {
  it('round-trips highlights, bookmarks, and comments with CFI and multi-signal locators', () => {
    const parsed = parseAnnotationInterchange(exportText(), 'book-1');
    expect(parsed.state.highlights[0]).toMatchObject({
      cfiRange: 'epubcfi(/6/4!/4/2:3)',
      selectedText: 'quoted text',
      note: 'note',
    });
    expect(parsed.state.bookmarks[0]).toMatchObject({
      locator: {
        cfi: 'epubcfi(/6/4)',
        chapterRef: 'chapter.xhtml',
        selectedText: 'bookmark quote',
      },
    });
    expect(parsed.state.comments[0]).toMatchObject({
      body: '<script>alert(1)</script>',
      cfiRange: 'epubcfi(/6/4)',
    });
  });
  it('rejects malformed JSON, unsupported versions, and duplicate IDs', () => {
    expect(() => parseAnnotationInterchange('{', 'book-1')).toThrow(/Invalid JSON/);
    expect(() =>
      parseAnnotationInterchange(exportText().replace('1.0-draft', '2.0'), 'book-1'),
    ).toThrow();
    const duplicate = JSON.parse(exportText());
    duplicate.items[1].id = duplicate.items[0].id;
    expect(() => parseAnnotationInterchange(JSON.stringify(duplicate), 'book-1')).toThrow(
      /Duplicate/,
    );
  });
  it('rejects malformed locators, unknown fields, wrong publication identity, and oversized payloads', () => {
    const badLocator = JSON.parse(exportText());
    badLocator.items[0].target.selector.value = 'javascript:alert(1)';
    expect(() => parseAnnotationInterchange(JSON.stringify(badLocator), 'book-1')).toThrow();
    expect(() => parseAnnotationInterchange(exportText(), 'other-book')).toThrow(/identity/);
    expect(() => parseAnnotationInterchange(' '.repeat(1_000_001), 'book-1')).toThrow(/1 MB/);
  });
  it('does not dereference publication URIs or execute HTML-like text', () => {
    const parsed = parseAnnotationInterchange(exportText(), 'book-1');
    expect(parsed.document.source).toBe(publicationIdentity('book-1'));
    expect(parsed.state.comments[0]?.body).toBe('<script>alert(1)</script>');
    expect(parsed.document.items[0]?.body.format).toBe('text/plain');
  });
  it('preserves bounded namespaced extensions and the legacy Markdown parser remains unchanged', () => {
    const document = JSON.parse(exportText());
    document.items[0].extensions = {
      'https://example.test/extensions/context': { quote: 'synthetic', active: true },
    };
    const parsed = parseAnnotationInterchange(JSON.stringify(document), 'book-1');
    expect(parsed.document.items[0]?.extensions).toEqual(document.items[0].extensions);
    const markdown =
      '# Book - Exported Notes\n\n<!-- format: do-epub-studio-notes v1 -->\n\n## Highlights\n\n- "text" [epubcfi(/6/4)] (#ff0000)';
    expect(parseNotesMarkdown(markdown)?.format).toBe('do-epub-studio-notes');
  });

  it('rejects unsafe URI schemes and oversized extension payloads', () => {
    const unsafeUri = JSON.parse(exportText());
    unsafeUri.items[0].id = 'javascript:alert(1)';
    expect(() => parseAnnotationInterchange(JSON.stringify(unsafeUri), 'book-1')).toThrow();
    const oversizedExtension = JSON.parse(exportText());
    oversizedExtension.items[0].extensions = {
      'https://example.test/extensions/data': 'x'.repeat(32_769),
    };
    expect(() => parseAnnotationInterchange(JSON.stringify(oversizedExtension), 'book-1')).toThrow(
      /32 KB/,
    );
  });
});
