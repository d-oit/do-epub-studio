import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import type { AuthorPublication } from '@do-epub-studio/shared';
import { packageEpub3, type PackagedAsset, type PackagerOptions } from '../packager';
import { sanitizeAuthorStylesheet } from '../author-styles';
import { readZipEntries } from './fixtures/epub-helpers';
import { validateArchive } from '../archive-validator';

const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const STYLESHEET_ID = '22222222-2222-4222-8222-222222222222';
const packageOptions: PackagerOptions = {
  identifier: 'urn:uuid:stable-book-id',
  modifiedAt: '2026-11-05T12:00:00Z',
};
const samplePublication: AuthorPublication = {
  title: 'The Authoring Journey',
  creators: ['Ada Lovelace', 'Augusta King'],
  language: 'en',
  identifier: 'urn:uuid:custom-test-pub-123',
  description: 'A test publication created in the authoring workspace.',
  publisher: 'Analytical Press',
  rights: 'Public Domain',
  coverImageAssetId: IMAGE_ID,
  stylesheetAssetIds: [STYLESHEET_ID],
  chapters: [
    {
      id: 'ch-intro',
      title: 'Introduction',
      order: 0,
      contentHtml: `<p>Welcome to <em>native</em> authoring in d.o.EPUB Studio.</p><img src="asset:${IMAGE_ID}" alt="Diagram"><br><hr>`,
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

const sampleAssets: PackagedAsset[] = [
  {
    id: IMAGE_ID,
    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    mediaType: 'image/png',
  },
  {
    id: STYLESHEET_ID,
    data: new TextEncoder().encode('p { text-align: justify; color: #222; }'),
    mediaType: 'text/css',
  },
];

async function archive(
  publication: AuthorPublication = samplePublication,
  assets: readonly PackagedAsset[] = sampleAssets,
  options: PackagerOptions = packageOptions,
): Promise<Buffer> {
  return Buffer.from(await packageEpub3(publication, assets, options));
}

describe('EPUB 3 Packager', () => {
  it('generates an archive that passes archive safety validation', async () => {
    await expect(validateArchive(await archive())).resolves.toBeUndefined();
  });

  it('writes an uncompressed mimetype as the first ZIP entry', async () => {
    const epubBuffer = await archive();

    expect(epubBuffer.readUInt32LE(0)).toBe(0x04034b50);
    expect(epubBuffer.readUInt16LE(8)).toBe(0);
    expect(epubBuffer.readUInt16LE(26)).toBe(8);
    expect(epubBuffer.readUInt16LE(28)).toBe(0);
    expect(epubBuffer.subarray(30, 38).toString('utf8')).toBe('mimetype');
    expect(epubBuffer.subarray(38, 58).toString('ascii')).toBe('application/epub+zip');
  });

  it('produces byte-identical archives for one saved snapshot', async () => {
    const first = await archive();
    const second = await archive();
    expect(second.equals(first)).toBe(true);

    const changedTimestamp = await archive(samplePublication, sampleAssets, {
      ...packageOptions,
      modifiedAt: '2026-11-06T12:00:00Z',
    });
    expect(changedTimestamp.equals(first)).toBe(false);
  });

  it('packages complete metadata, cover, stylesheets, ordered spine and navigation', async () => {
    const entries = readZipEntries(await archive());

    expect(entries.has('META-INF/container.xml')).toBe(true);
    expect(entries.has('OEBPS/content.opf')).toBe(true);
    expect(entries.has('OEBPS/nav.xhtml')).toBe(true);
    expect(entries.has('OEBPS/styles/default.css')).toBe(true);
    expect(entries.has(`OEBPS/styles/${STYLESHEET_ID}.css`)).toBe(true);
    expect(entries.has(`OEBPS/assets/${IMAGE_ID}.png`)).toBe(true);
    expect(entries.has('OEBPS/chapters/ch-intro.xhtml')).toBe(true);
    expect(entries.has('OEBPS/chapters/ch-body.xhtml')).toBe(true);

    const opf = entries.get('OEBPS/content.opf')?.toString('utf8') ?? '';
    expect(opf).toContain('<dc:title>The Authoring Journey</dc:title>');
    expect(opf).toContain('<dc:creator>Ada Lovelace</dc:creator>');
    expect(opf).toContain('<dc:creator>Augusta King</dc:creator>');
    expect(opf).toContain('<dc:publisher>Analytical Press</dc:publisher>');
    expect(opf).toContain('<dc:rights>Public Domain</dc:rights>');
    expect(opf).toContain(
      '<dc:identifier id="pub-id">urn:uuid:custom-test-pub-123</dc:identifier>',
    );
    expect(opf).toContain('<meta property="dcterms:modified">2026-11-05T12:00:00Z</meta>');
    expect(opf).toContain('href="assets/11111111-1111-4111-8111-111111111111.png"');
    expect(opf).toContain('media-type="image/png" properties="cover-image"');
    expect(opf).toContain(`href="styles/${STYLESHEET_ID}.css" media-type="text/css"`);
    expect(opf).toContain(
      '<item id="ch-1" href="chapters/ch-intro.xhtml" media-type="application/xhtml+xml"/>',
    );
    expect(opf).toContain('<itemref idref="ch-1"/>');
    expect(opf.indexOf('href="chapters/ch-intro.xhtml"')).toBeLessThan(
      opf.indexOf('href="chapters/ch-body.xhtml"'),
    );
    expect(opf.split(`stylesheet-${STYLESHEET_ID}`).length - 1).toBe(1);

    const nav = entries.get('OEBPS/nav.xhtml')?.toString('utf8') ?? '';
    expect(nav).toContain(
      '<nav epub:type="toc" id="toc" role="doc-toc" title="Table of Contents">',
    );
    expect(nav).toContain('href="chapters/ch-intro.xhtml">Introduction</a>');
    expect(nav).toContain('href="chapters/ch-body.xhtml">Main Body</a>');

    const chapter = entries.get('OEBPS/chapters/ch-intro.xhtml')?.toString('utf8') ?? '';
    expect(chapter).toContain(
      '<img src="../assets/11111111-1111-4111-8111-111111111111.png" alt="Diagram" />',
    );
    expect(chapter).toContain(`href="../styles/${STYLESHEET_ID}.css"`);
    expect(chapter).toContain('<em>native</em>');
    expect(chapter).toContain('<br />');
    expect(chapter).toContain('<hr />');
  });

  it('uses the stable package identifier when publication metadata omits one', async () => {
    const publication = { ...samplePublication, identifier: undefined };
    const entries = readZipEntries(await archive(publication));
    const opf = entries.get('OEBPS/content.opf')?.toString('utf8') ?? '';
    expect(opf).toContain('<dc:identifier id="pub-id">urn:uuid:stable-book-id</dc:identifier>');
  });

  it('rejects missing, wrong-kind, or malformed asset references', async () => {
    const missing = {
      ...samplePublication,
      coverImageAssetId: '33333333-3333-4333-8333-333333333333',
    };
    await expect(packageEpub3(missing, sampleAssets, packageOptions)).rejects.toThrow(
      'Missing author asset',
    );

    const wrongCover = { ...samplePublication, coverImageAssetId: STYLESHEET_ID };
    await expect(packageEpub3(wrongCover, sampleAssets, packageOptions)).rejects.toThrow(
      'Cover image must reference an image asset',
    );

    const introChapter = samplePublication.chapters[0];
    if (!introChapter) throw new Error('Expected introduction chapter fixture');
    const malformed = {
      ...samplePublication,
      chapters: [
        {
          ...introChapter,
          contentHtml: '<img src="asset:not-a-uuid" alt="bad">',
        },
      ],
    };
    const entries = readZipEntries(await archive(malformed));
    const chapter = entries.get('OEBPS/chapters/ch-intro.xhtml')?.toString('utf8') ?? '';
    expect(chapter).toContain('<img alt="bad" />');
  });

  it('omits unreferenced local assets from the publication snapshot', async () => {
    const unusedId = '33333333-3333-4333-8333-333333333333';
    const assets = [
      ...sampleAssets,
      { id: unusedId, data: new Uint8Array([1]), mediaType: 'image/gif' as const },
    ];
    const entries = readZipEntries(await archive(samplePublication, assets));
    expect(entries.has(`OEBPS/assets/${unusedId}.gif`)).toBe(false);
  });

  it('rejects active CSS constructs and accepts bounded semantic styles', () => {
    expect(sanitizeAuthorStylesheet('p { color: #123; text-align: justify; }')).toContain(
      'text-align: justify',
    );
    expect(() => sanitizeAuthorStylesheet('@import url(https://evil.example/x.css);')).toThrow();
    expect(() =>
      sanitizeAuthorStylesheet('p { background: url(https://evil.example/x); }'),
    ).toThrow();
    expect(() => sanitizeAuthorStylesheet('p { behavior: url(x); }')).toThrow();
  });

  it('parses hostile markup and emits only safe, well-formed XHTML', async () => {
    const hostilePublication: AuthorPublication = {
      ...samplePublication,
      coverImageAssetId: undefined,
      stylesheetAssetIds: [],
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
            `<img src="asset:${IMAGE_ID}" onerror="run()" alt="Local image">`,
            '<img src="https://evil.example/image.png" onerror="run()" alt="Remote image">',
            '<svg onload="run()"><script>run()</script></svg>',
            `<p>Control: ${String.fromCharCode(1)} ok</p>`,
            '<span>'.repeat(128) + 'Deeply nested text' + '</span>'.repeat(128),
          ].join(''),
        },
      ],
    };

    const entries = readZipEntries(await archive(hostilePublication));
    const chapter = entries.get('OEBPS/chapters/ch-hostile.xhtml')?.toString('utf8') ?? '';

    expect(chapter).toContain('<p>Visible &amp; unescaped</p>');
    expect(chapter).toContain('<a href="mailto:editor@example.com">Email</a>');
    expect(chapter).toContain(`<img src="../assets/${IMAGE_ID}.png" alt="Local image" />`);
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
