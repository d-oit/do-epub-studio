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
function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let state = 0x12345678;
  for (let index = 0; index < bytes.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state >>> 24;
  }
  return bytes;
}

function randomText(size: number): string {
  const bytes = randomBytes(size);
  const alphabet = encoder.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  bytes.forEach((byte, index) => {
    bytes[index] = alphabet[byte % alphabet.length] ?? alphabet[0] ?? 0;
  });
  return new TextDecoder().decode(bytes);
}
function mixedPayload(totalBytes: number, randomPrefixBytes: number): Uint8Array {
  const payload = new Uint8Array(totalBytes);
  payload.set(randomBytes(randomPrefixBytes));
  return payload;
}

async function sourceEpub(
  payload: Uint8Array = new Uint8Array(),
  options: { storePayload?: boolean; extraEntryCount?: number; extraEntryName?: string } = {},
): Promise<{ bytes: Uint8Array; chapter: Uint8Array }> {
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
        `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:test-book</dc:identifier><dc:title>Book &amp; Title</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2024-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>${payload.byteLength > 0 ? '<item id="payload" href="payload.bin" media-type="application/octet-stream"/>' : ''}</manifest><spine><itemref idref="chapter"/></spine></package>`,
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
    ...(payload.byteLength > 0
      ? [{ name: 'OEBPS/payload.bin', data: payload, store: options.storePayload ?? true }]
      : []),
    ...(options.extraEntryName ? [{ name: options.extraEntryName, data: new Uint8Array() }] : []),
    ...Array.from({ length: options.extraEntryCount ?? 0 }, (_, index) => ({
      name: `OEBPS/extra-${index}.bin`,
      data: new Uint8Array(),
    })),
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
    expect(appendix).toContain('href="chapter.xhtml#epubcfi(!/4/2:0[Source^, text])"');
    expect(appendix).toMatch(
      /<li id="annotation-2"><h2>Comment 2<\/h2>[\s\S]*?href="chapter\.xhtml#epubcfi\(!\/4\/2:0\[Comment\]\)"/,
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

async function sourceEpub2(): Promise<Uint8Array> {
  return buildZip([
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
        '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" unique-identifier="book-id"><metadata><dc:identifier id="book-id">urn:uuid:book-two</dc:identifier><dc:title>Book Two</dc:title><dc:language>en</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter"/></spine></package>',
      ),
    },
    {
      name: 'OEBPS/toc.ncx',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:book-two"/></head><docTitle><text>Contents</text></docTitle><navMap><navPoint id="np-1" playOrder="1"><navLabel><text>Chapter</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>',
      ),
    },
    {
      name: 'OEBPS/chapter.xhtml',
      data: encoder.encode(
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><p>Publication text.</p></body></html>',
      ),
    },
  ]);
}

describe('bounded annotation EPUB export validation', () => {
  it('exports EPUB 2 sources with an NCX appendix entry and XHTML 1.1 appendix', async () => {
    const source = await sourceEpub2();
    const annotations: EpubExportAnnotation[] = [
      annotation({
        id: 'highlight-v2',
        type: 'highlight',
        selectedText: 'Two',
        note: 'An EPUB 2 note',
        chapterRef: 'chapter.xhtml',
        cfi: 'epubcfi(/6/2[chapter]!/4/2:0)',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
      annotation({
        id: 'comment-v2',
        type: 'comment',
        body: 'An EPUB 2 comment',
        chapterRef: 'chapter.xhtml',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
    ];

    const output = await exportAnnotationsToEpub(source, annotations, {
      revisionId: 'revision-current',
    });
    const entries = readZipEntries(Buffer.from(output));
    const opf = entries.get('OEBPS/content.opf')?.toString('utf8') ?? '';
    const ncx = entries.get('OEBPS/toc.ncx')?.toString('utf8') ?? '';
    const appendix = entries.get('OEBPS/annotations.xhtml')?.toString('utf8') ?? '';

    expect(opf).toContain('version="2.0"');
    expect(opf).toContain(
      'id="annotations" href="annotations.xhtml" media-type="application/xhtml+xml"',
    );
    expect(opf).toContain('<itemref idref="annotations"/>');
    expect(ncx).toContain('<navPoint id="annotations-nav" playOrder="2">');
    expect(ncx).toContain('<content src="annotations.xhtml"/>');
    expect(appendix).toContain('class="appendix"');
    expect(appendix).not.toContain('epub:type="appendix"');
    expect(appendix).toContain(
      '<meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>',
    );
    expect(appendix).not.toContain('<meta charset="utf-8"/>');
    expect(appendix).toContain('href="chapter.xhtml#epubcfi(!/4/2:0)"');
    expect(appendix).toContain('href="chapter.xhtml"');
    expect(appendix).toContain('An EPUB 2 note');
  });

  it('rejects signed sources and DRM/encrypted sources with explicit errors', async () => {
    const signed = await buildZip([
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
      },
      {
        name: 'content.opf',
        data: encoder.encode(
          '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="nav"/></spine></package>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol></ol></nav></body></html>',
        ),
      },
      {
        name: 'META-INF/signatures.xml',
        data: encoder.encode('<signatures xmlns="http://www.idpf.org/2008/signatures"/>'),
      },
    ]);
    await expect(exportAnnotationsToEpub(signed, [], { revisionId: null })).rejects.toMatchObject({
      code: 'SIGNATURES_UNSUPPORTED',
    });

    const drm = await buildZip([
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
      },
      {
        name: 'content.opf',
        data: encoder.encode(
          '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="nav"/></spine></package>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol></ol></nav></body></html>',
        ),
      },
      {
        name: 'META-INF/license.lcpl',
        data: encoder.encode('<license xmlns="https://readium.org/lcp-schema"/>'),
      },
    ]);
    await expect(exportAnnotationsToEpub(drm, [], { revisionId: null })).rejects.toMatchObject({
      code: 'ENCRYPTION_UNSUPPORTED',
    });
  });

  it('rejects unsupported encryption algorithms and preserves permitted font obfuscation', async () => {
    const base = [
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
      },
      {
        name: 'content.opf',
        data: encoder.encode(
          '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="font" href="OEBPS/font.otf" media-type="application/vnd.ms-opentype"/></manifest><spine><itemref idref="nav"/></spine></package>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol></ol></nav></body></html>',
        ),
      },
      { name: 'OEBPS/font.otf', data: new Uint8Array([0, 1, 2]) },
    ] as const;

    const unsupported = await buildZip([
      ...base,
      {
        name: 'META-INF/encryption.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><encryption xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><CipherData><CipherReference URI="OEBPS/font.otf"/></CipherData></EncryptedData></encryption>',
        ),
      },
    ]);
    await expect(
      exportAnnotationsToEpub(unsupported, [], { revisionId: null }),
    ).rejects.toMatchObject({ code: 'ENCRYPTION_UNSUPPORTED' });

    const allowed = await buildZip([
      ...base,
      {
        name: 'META-INF/encryption.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><encryption xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherData><CipherReference URI="OEBPS/font.otf"/></CipherData></EncryptedData></encryption>',
        ),
      },
    ]);
    const output = await exportAnnotationsToEpub(allowed, [], { revisionId: null });
    const entries = readZipEntries(Buffer.from(output));
    expect(entries.get('META-INF/encryption.xml')?.toString('utf8')).toContain(
      'http://www.idpf.org/2008/embedding',
    );
  });

  it('rejects case-conflicting entry paths in the source', async () => {
    const conflict = await buildZip([
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
      },
      {
        name: 'content.opf',
        data: encoder.encode(
          '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="nav"/></spine></package>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol></ol></nav></body></html>',
        ),
      },
      {
        name: 'NAV.xhtml',
        data: encoder.encode('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>'),
      },
    ]);
    await expect(exportAnnotationsToEpub(conflict, [], { revisionId: null })).rejects.toMatchObject(
      { code: 'SOURCE_UNSAFE' },
    );
  });

  it(
    'produces deterministic output bytes for identical explicit inputs',
    { timeout: 20000 },
    async () => {
      const source = await sourceEpub();
      const annotations: EpubExportAnnotation[] = [
        annotation({
          id: 'deterministic-1',
          type: 'highlight',
          selectedText: 'Same',
          note: 'Stable',
          chapterRef: 'chapter.xhtml',
          cfi: 'epubcfi(/6/2[chapter]!/4/2:0)',
          revisionId: 'revision-current',
          anchorStatus: 'anchored',
        }),
      ];
      const first = await exportAnnotationsToEpub(source.bytes, annotations, {
        revisionId: 'revision-current',
      });
      const second = await exportAnnotationsToEpub(source.bytes, annotations, {
        revisionId: 'revision-current',
      });
      expect(Buffer.from(first)).toEqual(Buffer.from(second));
    },
  );

  it('derives the spine element step from the parsed package child order', async () => {
    const source = await buildZip([
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode(
          '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        ),
      },
      {
        name: 'content.opf',
        data: encoder.encode(
          '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><guide><reference type="text" title="Start" href="chapter.xhtml"/></guide><spine><itemref idref="chapter"/></spine></package>',
        ),
      },
      {
        name: 'nav.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol></ol></nav></body></html>',
        ),
      },
      {
        name: 'chapter.xhtml',
        data: encoder.encode(
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Text</p></body></html>',
        ),
      },
    ]);
    const annotations: EpubExportAnnotation[] = [
      annotation({
        id: 'spine-step-1',
        type: 'comment',
        body: 'Spine is the fourth package child',
        cfi: 'epubcfi(/8/2[chapter]!/4/2:0)',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
      annotation({
        id: 'spine-step-2',
        type: 'comment',
        body: 'Wrong spine step stays unresolved',
        cfi: 'epubcfi(/6/2[chapter]!/4/2:0)',
        revisionId: 'revision-current',
        anchorStatus: 'anchored',
      }),
    ];
    const output = await exportAnnotationsToEpub(source, annotations, {
      revisionId: 'revision-current',
    });
    const entries = readZipEntries(Buffer.from(output));
    const appendix = entries.get('annotations.xhtml')?.toString('utf8') ?? '';
    expect(appendix).toContain('href="chapter.xhtml#epubcfi(!/4/2:0)"');
    expect(appendix).toContain('Location unresolved');
  });
  it(
    'allows generated output above the source compressed limit within the output limit',
    { timeout: 20000 },
    async () => {
      const source = await sourceEpub(randomBytes(7.4 * 1024 * 1024));
      expect(source.bytes.byteLength).toBeLessThanOrEqual(
        EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes,
      );

      const output = await exportAnnotationsToEpub(
        source.bytes,
        [annotation({ id: 'large', type: 'comment', body: randomText(900 * 1024) })],
        { revisionId: null },
      );

      expect(output.byteLength).toBeGreaterThan(
        EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes,
      );
      expect(output.byteLength).toBeLessThanOrEqual(
        EPUB_ANNOTATION_EXPORT_LIMITS.maxOutputCompressedBytes,
      );
    },
  );

  it(
    'rejects source archives that exceed expanded-byte and entry-count limits',
    { timeout: 20000 },
    async () => {
      const oversized = await sourceEpub(mixedPayload(26 * 1024 * 1024, 3 * 1024 * 1024), {
        storePayload: false,
      });
      await expect(
        exportAnnotationsToEpub(oversized.bytes, [], { revisionId: null }),
      ).rejects.toMatchObject({ code: 'SOURCE_TOO_LARGE' });

      const tooManyEntries = await sourceEpub(new Uint8Array(), { extraEntryCount: 9_995 });
      await expect(
        exportAnnotationsToEpub(tooManyEntries.bytes, [], { revisionId: null }),
      ).rejects.toMatchObject({ code: 'SOURCE_TOO_LARGE' });
    },
  );

  it('rejects unsafe traversal paths before package parsing', async () => {
    const unsafe = await sourceEpub(new Uint8Array(), { extraEntryName: '../outside.xhtml' });
    await expect(
      exportAnnotationsToEpub(unsafe.bytes, [], { revisionId: null }),
    ).rejects.toMatchObject({ code: 'SOURCE_UNSAFE' });
  });

  it('rejects generated output that exceeds its independent compressed-byte cap', async () => {
    const source = await sourceEpub(mixedPayload(13 * 1024 * 1024, 7 * 1024 * 1024), {
      storePayload: false,
    });
    expect(source.bytes.byteLength).toBeLessThanOrEqual(
      EPUB_ANNOTATION_EXPORT_LIMITS.maxSourceCompressedBytes,
    );
    await expect(
      exportAnnotationsToEpub(
        source.bytes,
        [annotation({ id: 'cap', type: 'comment', body: 'within the annotation-text cap' })],
        { revisionId: null },
      ),
    ).rejects.toMatchObject({ code: 'OUTPUT_TOO_LARGE' });
  }, 30_000);
});

describe('bounded annotation EPUB export boundary checks', () => {
  it('rejects oversized container documents before full decode', { timeout: 20000 }, async () => {
    const source = await buildZip([
      { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
      {
        name: 'META-INF/container.xml',
        data: encoder.encode('x'.repeat(64 * 1024 + 1)),
        store: true,
      },
    ]);
    await expect(exportAnnotationsToEpub(source, [], { revisionId: null })).rejects.toMatchObject({
      code: 'SOURCE_TOO_LARGE',
    });
  });
});
