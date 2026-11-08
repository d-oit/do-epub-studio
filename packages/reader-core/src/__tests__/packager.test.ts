import { describe, expect, it } from 'vitest';
import type { AuthorPublication } from '@do-epub-studio/shared';
import { packageEpub3 } from '../packager';
import { readZipEntries } from './fixtures/epub-helpers';
import { validateArchive } from '../archive-validator';

describe('EPUB 3 Packager', () => {
  const samplePublication: AuthorPublication = {
    title: 'The Authoring Journey',
    authorName: 'Ada Lovelace',
    language: 'en',
    identifier: 'urn:uuid:custom-test-pub-123',
    description: 'A test publication created in the authoring workspace.',
    rights: 'Public Domain',
    chapters: [
      {
        id: 'ch-intro',
        title: 'Introduction',
        order: 0,
        contentHtml:
          '<p>Welcome to <em>native</em> authoring in d.o.EPUB Studio.</p><img src="assets/diag.png" alt="Diagram"><br><hr>',
      },
      {
        id: 'ch-body',
        title: 'Main Body',
        order: 1,
        contentHtml:
          '<p>Here is content with <script>alert("xss")</script><button onclick="exploit()">Click</button>safe text.</p>',
      },
    ],
  };

  const sampleAssets = [
    {
      name: 'diag.png',
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mediaType: 'image/png',
    },
  ];

  it('generates an archive that passes archive safety validation', async () => {
    const epubBuffer = packageEpub3(samplePublication, sampleAssets);
    await expect(validateArchive(epubBuffer)).resolves.toBeUndefined();
  });

  it('adheres to OCF container specifications at offset 0', () => {
    const epubBuffer = packageEpub3(samplePublication, sampleAssets);

    // ZIP local file header signature
    expect(epubBuffer.readUInt32LE(0)).toBe(0x04034b50);
    // Compression method: 0 (STORE)
    expect(epubBuffer.readUInt16LE(8)).toBe(0);
    // Filename length: 8 ('mimetype')
    expect(epubBuffer.readUInt16LE(26)).toBe(8);
    // Extra field length: 0
    expect(epubBuffer.readUInt16LE(28)).toBe(0);

    const filename = epubBuffer.subarray(30, 38).toString('utf8');
    expect(filename).toBe('mimetype');

    const mimetypeContent = epubBuffer.subarray(38, 58).toString('ascii');
    expect(mimetypeContent).toBe('application/epub+zip');
  });

  it('constructs correct EPUB 3 manifest, spine, and navigation', () => {
    const epubBuffer = packageEpub3(samplePublication, sampleAssets, {
      modifiedAt: '2026-11-05T12:00:00Z',
    });
    const entries = readZipEntries(epubBuffer);

    expect(entries.has('META-INF/container.xml')).toBe(true);
    expect(entries.has('OEBPS/content.opf')).toBe(true);
    expect(entries.has('OEBPS/nav.xhtml')).toBe(true);
    expect(entries.has('OEBPS/style.css')).toBe(true);
    expect(entries.has('OEBPS/chapters/ch-intro.xhtml')).toBe(true);
    expect(entries.has('OEBPS/chapters/ch-body.xhtml')).toBe(true);
    expect(entries.has('OEBPS/assets/diag.png')).toBe(true);

    const opf = entries.get('OEBPS/content.opf')?.toString('utf8') ?? '';
    expect(opf).toContain('<dc:title>The Authoring Journey</dc:title>');
    expect(opf).toContain('<dc:creator>Ada Lovelace</dc:creator>');
    expect(opf).toContain(
      '<dc:identifier id="pub-id">urn:uuid:custom-test-pub-123</dc:identifier>',
    );
    expect(opf).toContain('<meta property="dcterms:modified">2026-11-05T12:00:00Z</meta>');
    expect(opf).toContain(
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    );
    expect(opf).toContain(
      '<item id="ch-1" href="chapters/ch-intro.xhtml" media-type="application/xhtml+xml"/>',
    );
    expect(opf).toContain(
      '<item id="ch-2" href="chapters/ch-body.xhtml" media-type="application/xhtml+xml"/>',
    );
    expect(opf).toContain('<item id="asset-1" href="assets/diag.png" media-type="image/png"/>');
    expect(opf).toContain('<itemref idref="ch-1"/>');
    expect(opf).toContain('<itemref idref="ch-2"/>');

    const nav = entries.get('OEBPS/nav.xhtml')?.toString('utf8') ?? '';
    expect(nav).toContain(
      '<nav epub:type="toc" id="toc" role="doc-toc" aria-label="Table of Contents">',
    );
    expect(nav).toContain('href="chapters/ch-intro.xhtml">Introduction</a>');
    expect(nav).toContain('href="chapters/ch-body.xhtml">Main Body</a>');

    const ch1 = entries.get('OEBPS/chapters/ch-intro.xhtml')?.toString('utf8') ?? '';
    expect(ch1).toContain('<h1 id="chapter-title">Introduction</h1>');
    expect(ch1).toContain('<em>native</em>');
    // Ensure void tags are properly self-closed in XML
    expect(ch1).toContain('<img src="assets/diag.png" alt="Diagram" />');
    expect(ch1).toContain('<br />');
    expect(ch1).toContain('<hr />');

    const ch2 = entries.get('OEBPS/chapters/ch-body.xhtml')?.toString('utf8') ?? '';
    expect(ch2).toContain('<h1 id="chapter-title">Main Body</h1>');
    // Ensure active script and event handler are stripped
    expect(ch2).not.toContain('<script>');
    expect(ch2).not.toContain('alert');
    expect(ch2).not.toContain('onclick');
    expect(ch2).not.toContain('exploit');
  });
  it('parses hostile markup and emits only safe, well-formed XHTML', () => {
    const hostilePublication: AuthorPublication = {
      ...samplePublication,
      chapters: [
        {
          id: 'ch-hostile',
          title: 'Security Test',
          order: 0,
          contentHtml: [
            '<p onclick="run()">Visible & unescaped</p>',
            '<script>run()</script >',
            '<button onclick="run()">Button text</button>',
            '<iframe src="https://evil.example">Frame text</iframe>',
            '<a href="jav&#x61;script:run()">Unsafe link</a>',
            '<a href="mailto:editor@example.com">Email</a>',
            '<img src="https://evil.example/image.png" onerror="run()" alt="Remote image">',
            '<svg onload="run()"><script>run()</script></svg>',
            `<p>Control: ${String.fromCharCode(1)} ok</p>`,
            '<span>'.repeat(128) + 'Deeply nested text' + '</span>'.repeat(128),
          ].join(''),
        },
      ],
    };

    const entries = readZipEntries(packageEpub3(hostilePublication, sampleAssets));
    const chapter = entries.get('OEBPS/chapters/ch-hostile.xhtml')?.toString('utf8') ?? '';

    expect(chapter).toContain('<p>Visible &amp; unescaped</p>');
    expect(chapter).toContain('<a href="mailto:editor@example.com">Email</a>');
    expect(chapter).toContain('<img alt="Remote image" />');
    expect(chapter).not.toContain('onclick');
    expect(chapter).not.toContain('onerror');
    expect(chapter).not.toContain('run()');
    expect(chapter).not.toContain('Button text');
    expect(chapter).not.toContain('Frame text');
    expect(chapter).not.toContain('javascript:');
    expect(chapter).not.toContain('evil.example');
    expect(chapter).not.toContain('<svg');
    expect(chapter).toContain('Deeply nested text');
    expect(chapter).not.toContain(String.fromCharCode(1));
  });
});
