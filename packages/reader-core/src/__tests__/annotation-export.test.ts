import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  EPUB_ANNOTATION_EXPORT_LIMITS,
  exportAnnotationsToEpub,
  type EpubExportAnnotation,
} from '../packager/annotation-export';
import { parseCfiSpineIndex } from '../packager/annotation-export-cfi';
import { buildZip } from '../packager/zip';
import { readZipEntries } from './fixtures/epub-helpers';

const encoder = new TextEncoder();

async function sourceEpub(): Promise<{ bytes: Uint8Array; chapter: Uint8Array }> {
  const chapter = encoder.encode(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><p>Publication text.</p></body></html>',
  );
  const bytes = await buildZip([
    { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
    {
      name: 'META-INF/container.xml',
      data: encoder.encode(
        '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
    },
    {
      name: 'OEBPS/content.opf',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:test-book</dc:identifier><dc:title>Book &amp; Title</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2024-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: encoder.encode(
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc" id="toc" role="doc-toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">Chapter</a></li></ol></nav></body></html>',
      ),
    },
    { name: 'OEBPS/chapter.xhtml', data: chapter },
    { name: 'OEBPS/image.bin', data: new Uint8Array([0, 1, 2, 255]) },
  ]);
  return { bytes, chapter };
}

type AnnotationOverrides = Pick<EpubExportAnnotation, 'id' | 'type'> &
  Partial<Omit<EpubExportAnnotation, 'id' | 'type'>>;

function annotation(overrides: AnnotationOverrides): EpubExportAnnotation {
  return { ...overrides, body: overrides.body ?? '' };
}

describe('bounded annotation EPUB export', () => {
  it('adds safe annotation content and source links for resolvable types while retaining stale records', async () => {
    const source = await sourceEpub();
    const annotations: EpubExportAnnotation[] = [
      annotation({
        id: 'highlight-1',
        type: 'highlight',
        note: '<script>alert("x")</script> & note',
        selectedText: '<selected & passage>',
        chapterRef: 'chapter.xhtml',
        cfi: 'epubcfi(/6/2[chapter]!/4/2:0[Source^, text])',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
      annotation({
        id: 'comment-anchored',
        type: 'comment',
        body: 'An anchored comment.',
        chapterRef: 'chapter.xhtml',
        cfi: 'epubcfi(/6/2[chapter]!/4/2:0[Comment])',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
      annotation({
        id: 'bookmark-1',
        type: 'bookmark',
        label: 'Read later',
        chapterRef: 'OEBPS/chapter.xhtml',
      }),
      annotation({
        id: 'comment-stale',
        type: 'comment',
        body: 'javascript:alert("stored as text")',
        chapterRef: 'https://remote.invalid/chapter.xhtml',
        cfi: 'epubcfi(/6/2!/4/2',
        revisionId: 'revision-old',
        anchorStatus: 'orphaned',
        originalChapterRef: 'OEBPS/chapter.xhtml',
        originalCfi: 'epubcfi(/6/2!/4/2)',
        originalSelectedText: 'Original & context',
      }),
      annotation({
        id: 'reply-1',
        type: 'comment',
        body: 'A reply',
        parentCommentId: 'comment-stale',
      }),
    ];

    const output = await exportAnnotationsToEpub(source.bytes, annotations, {
      revisionId: 'revision-current',
    });
    const entries = readZipEntries(Buffer.from(output));
    const opf = entries.get('OEBPS/content.opf')?.toString('utf8') ?? '';
    const nav = entries.get('OEBPS/nav.xhtml')?.toString('utf8') ?? '';
    const appendix = entries.get('OEBPS/annotations.xhtml')?.toString('utf8') ?? '';

    expect(opf).toContain('<dc:title>Book &amp; Title</dc:title>');
    expect(opf).toContain(
      'id="annotations" href="annotations.xhtml" media-type="application/xhtml+xml"',
    );
    expect(opf).toContain('<itemref idref="annotations"/>');
    expect(nav).toContain('<a href="annotations.xhtml">Annotations</a>');
    expect(appendix).toContain('epub:type="appendix"');
    expect(appendix).toContain('href="content.opf#epubcfi');
    expect(appendix).toMatch(
      /<li id="annotation-2"><h2>Comment 2<\/h2>[\s\S]*?href="content\.opf#epubcfi/,
    );
    expect(appendix).toContain('href="chapter.xhtml"');
    expect(appendix).toContain('Location unresolved');
    expect(appendix).toContain('Highlight 1');
    expect(appendix).toContain('Comment 2');
    expect(appendix).toContain('Bookmark 3');
    expect(appendix).toContain('Comment 4');
    expect(appendix).toContain('Reply to <a href="#annotation-4">comment 4</a>');
    expect(appendix).toContain('&lt;script&gt;');
    expect(appendix).not.toContain('<script>alert');
    expect(appendix).not.toContain('href="https://remote.invalid');
    expect(appendix).toContain('Original &amp; context');
    expect(appendix).toContain('Original CFI:');
    expect(entries.get('OEBPS/chapter.xhtml')).toEqual(Buffer.from(source.chapter));
    expect(entries.get('OEBPS/image.bin')).toEqual(Buffer.from([0, 1, 2, 255]));
  });

  it('accepts safe CFI points and ranges but rejects malformed or ambiguous CFI syntax', () => {
    expect(parseCfiSpineIndex('epubcfi(/6/2[chapter]!/4/2:0[Text^, assertion])')).toBe(0);
    expect(parseCfiSpineIndex('epubcfi(/6/2!/4/2,/1:0,/1:8)')).toBe(0);
    expect(parseCfiSpineIndex('epubcfi(/6/3!/4/2)')).toBeNull();
    expect(parseCfiSpineIndex('epubcfi(/6/2!remote/path)')).toBeNull();
    expect(parseCfiSpineIndex('epubcfi(/6/2!/4/2')).toBeNull();
  });

  it('rejects source, annotation-count and aggregate-text limit violations without truncating', async () => {
    const source = await sourceEpub();
    await expect(
      exportAnnotationsToEpub(
        new Uint8Array(EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes + 1),
        [],
        { revisionId: null },
      ),
    ).rejects.toMatchObject({ code: 'SOURCE_TOO_LARGE' });

    const many = Array.from(
      { length: EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotations + 1 },
      (_, index) => annotation({ id: `too-many-${index}`, type: 'comment' }),
    );
    await expect(
      exportAnnotationsToEpub(source.bytes, many, { revisionId: null }),
    ).rejects.toMatchObject({ code: 'ANNOTATIONS_TOO_LARGE' });

    await expect(
      exportAnnotationsToEpub(
        source.bytes,
        [annotation({ id: 'too-large', type: 'comment', body: 'x'.repeat(1024 * 1024 + 1) })],
        { revisionId: null },
      ),
    ).rejects.toMatchObject({ code: 'ANNOTATIONS_TOO_LARGE' });
  });

  it('rejects malformed source archives instead of producing an EPUB', async () => {
    await expect(
      exportAnnotationsToEpub(new Uint8Array([1, 2, 3]), [], { revisionId: null }),
    ).rejects.toMatchObject({ code: 'SOURCE_INVALID' });
  });

  it('rejects malformed annotation text instead of stringifying it', async () => {
    const source = await sourceEpub();
    const malformed = {
      id: 'malformed',
      type: 'comment',
      body: 42,
    } as unknown as EpubExportAnnotation;
    await expect(
      exportAnnotationsToEpub(source.bytes, [malformed], { revisionId: null }),
    ).rejects.toMatchObject({ code: 'ANNOTATIONS_INVALID' });
  });
});
