import { describe, it, expect } from 'vitest';
import { parseNotesMarkdown } from '../features/reader/lib/export-notes-markdown';
import { NOTES_FORMAT_VERSION } from '../features/reader/lib/notes-types';

function header(title = 'My Book') {
  return [
    `# ${title} - Exported Notes`,
    '',
    '<!-- format: do-epub-studio-notes v1 -->',
    '<!-- exportedAt: 2026-06-24T00:00:00.000Z -->',
    '<!-- bookId: book-1 -->',
    '',
  ].join('\n');
}

describe('parseNotesMarkdown', () => {
  it('returns null for unrecognized format', () => {
    expect(parseNotesMarkdown('# Random markdown\nJust text.')).toBeNull();
  });

  it('returns null for wrong version', () => {
    const md = [
      '# Book - Exported Notes',
      '',
      '<!-- format: do-epub-studio-notes v2 -->',
      '',
    ].join('\n');
    expect(parseNotesMarkdown(md)).toBeNull();
  });

  it('parses header metadata', () => {
    const md = header('Test Book');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.format).toBe('do-epub-studio-notes');
    expect(r.version).toBe(NOTES_FORMAT_VERSION);
    expect(r.bookTitle).toBe('Test Book');
    expect(r.bookId).toBe('book-1');
    expect(r.exportedAt).toBe('2026-06-24T00:00:00.000Z');
  });

  it('parses highlights with CFI locator and color', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "highlighted text" [epubcfi(/6/4!/4/2/1:0)] (#ff0000)',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(1);
    const h = r.annotations[0];
    expect(h.type).toBe('highlight');
    if (h.type === 'highlight') {
      expect(h.selectedText).toBe('highlighted text');
      expect(h.color).toBe('#ff0000');
      expect(h.note).toBeNull();
      expect(h.locator).not.toBeNull();
      const loc = h.locator ?? (() => { throw new Error('expected defined'); })();
      expect(loc.cfi).toBe('epubcfi(/6/4!/4/2/1:0)');
    }
  });

  it('parses highlight with note after em-dash', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "Some text" [epubcfi(/6/4!/4/2/1:0)] (#00ff00) — This is my note',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    const h = r.annotations[0];
    if (h.type === 'highlight') {
      expect(h.selectedText).toBe('Some text');
      expect(h.color).toBe('#00ff00');
      expect(h.note).toBe('This is my note');
    }
  });

  it('parses highlight with chapter reference', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "text" [epubcfi(/6/4!/4/2/1:0)] (ch1.xhtml) (#ffeb3b)',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    const h = r.annotations[0];
    if (h.type === 'highlight') {
      expect(h.locator).not.toBeNull();
      const loc = h.locator ?? (() => { throw new Error('expected defined'); })();
      expect(loc.cfi).toBe('epubcfi(/6/4!/4/2/1:0)');
      expect(loc.chapterRef).toBe('ch1.xhtml');
    }
  });

  it('parses bookmarks with CFI and label', () => {
    const md = [
      header(),
      '## Bookmarks',
      '',
      '- Bookmarked text [epubcfi(/6/4!/4/10/2:0)] (ch2.xhtml) — My bookmark',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(1);
    const b = r.annotations[0];
    expect(b.type).toBe('bookmark');
    if (b.type === 'bookmark') {
      expect(b.locator.selectedText).toBe('Bookmarked text');
      expect(b.label).toBe('My bookmark');
      expect(b.locator.cfi).toBe('epubcfi(/6/4!/4/10/2:0)');
      expect(b.locator.chapterRef).toBe('ch2.xhtml');
    }
  });

  it('parses bookmarks without label', () => {
    const md = [
      header(),
      '## Bookmarks',
      '',
      '- Some bookmark text',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    const b = r.annotations[0];
    if (b.type === 'bookmark') {
      expect(b.locator.selectedText).toBe('Some bookmark text');
      expect(b.label).toBeNull();
    }
  });

  it('parses comments', () => {
    const md = [
      header(),
      '## Comments',
      '',
      '- Great point! [epubcfi(/6/4!/4/2/3:0)] — "quoted text"',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(1);
    const c = r.annotations[0];
    expect(c.type).toBe('comment');
    if (c.type === 'comment') {
      expect(c.body).toBe('Great point!');
      expect(c.selectedText).toBe('quoted text');
      expect(c.locator).not.toBeNull();
      const loc = c.locator ?? (() => { throw new Error('expected defined'); })();
      expect(loc.cfi).toBe('epubcfi(/6/4!/4/2/3:0)');
      expect(c.status).toBe('open');
      expect(c.visibility).toBe('shared');
    }
  });

  it('parses comments without quote', () => {
    const md = [
      header(),
      '## Comments',
      '',
      '- Just a comment body',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    const c = r.annotations[0];
    if (c.type === 'comment') {
      expect(c.body).toBe('Just a comment body');
      expect(c.selectedText).toBeNull();
    }
  });

  it('parses multiple sections together', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "highlighted" [epubcfi(/6/4!/4/2/1:0)] (#ff0000)',
      '',
      '## Bookmarks',
      '',
      '- bookmarked text [epubcfi(/6/4!/4/10/2:0)]',
      '',
      '## Comments',
      '',
      '- A comment body',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(3);
    expect(r.annotations.filter((a: { type: string }) => a.type === 'highlight')).toHaveLength(1);
    expect(r.annotations.filter((a: { type: string }) => a.type === 'bookmark')).toHaveLength(1);
    expect(r.annotations.filter((a: { type: string }) => a.type === 'comment')).toHaveLength(1);
  });

  it('skips lines not starting with dash', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      'not a highlight line',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(0);
  });

  it('defaults bookTitle when title missing', () => {
    const md = [
      '<!-- format: do-epub-studio-notes v1 -->',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.bookTitle).toBe('Imported Book');
  });

  it('defaults bookId to null when missing', () => {
    const md = [
      '# Title - Exported Notes',
      '',
      '<!-- format: do-epub-studio-notes v1 -->',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.bookId).toBeNull();
  });

  it('falls back to default color when no color specified', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "Some text" [epubcfi(/6/4!/4/2/1:0)]',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    const h = r.annotations[0];
    if (h.type === 'highlight') {
      expect(h.color).toBe('#ffeb3b');
    }
  });

  it('ignores lines outside of known sections', () => {
    const md = [
      header(),
      '## Highlights',
      '',
      '- "valid highlight" [epubcfi(/6/4!/4/2/1:0)] (#ff0000)',
      '',
      '## Some Other Section',
      '',
      '- "ignored highlight"',
      '',
    ].join('\n');
    const result = parseNotesMarkdown(md);
    expect(result).not.toBeNull();
    const r = result ?? (() => { throw new Error('expected defined'); })();
    expect(r.annotations).toHaveLength(1);
  });

  it('returns null when format header missing entirely', () => {
    const md = '# Just a title\n\nSome content.\n';
    expect(parseNotesMarkdown(md)).toBeNull();
  });
});
