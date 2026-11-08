import { Buffer } from 'node:buffer';
import type { AuthorPublication } from '@do-epub-studio/shared';
import { buildZip, type ZipEntry } from './zip';
import { escapeXml, sanitizeChapterXhtml } from './serializer';

export interface PackagedAsset {
  name: string;
  data: Uint8Array;
  mediaType: string;
}

export interface PackagerOptions {
  modifiedAt?: string;
  identifier?: string;
}

const DEFAULT_STYLE_CSS = `
body {
  font-family: serif;
  line-height: 1.6;
  margin: 1.5rem auto;
  max-width: 42rem;
  padding: 0 1rem;
}
h1, h2, h3, h4, h5, h6 {
  font-family: sans-serif;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
p {
  margin-top: 0;
  margin-bottom: 1em;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
  text-align: left;
}
img {
  max-width: 100%;
  height: auto;
}
blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  font-style: italic;
}
code, pre {
  font-family: monospace;
}
`.trim();

/**
 * Deterministically packages an AuthorPublication and assets into a conforming EPUB 3 archive.
 */
export function packageEpub3(
  publication: AuthorPublication,
  assets: PackagedAsset[] = [],
  options: PackagerOptions = {},
): Buffer {
  const pubId =
    publication.identifier || options.identifier || `urn:uuid:book-${Date.now().toString(36)}`;
  const modifiedAt = options.modifiedAt || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sortedChapters = [...publication.chapters].sort((a, b) => a.order - b.order);

  const manifestItems: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="style" href="style.css" media-type="text/css"/>',
  ];
  const spineItems: string[] = [];

  sortedChapters.forEach((chapter, index) => {
    const itemId = `ch-${index + 1}`;
    manifestItems.push(
      `<item id="${itemId}" href="chapters/${escapeXml(chapter.id)}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${itemId}"/>`);
  });

  assets.forEach((asset, index) => {
    manifestItems.push(
      `<item id="asset-${index + 1}" href="assets/${escapeXml(asset.name)}" media-type="${escapeXml(asset.mediaType)}"/>`,
    );
  });

  const metadataXml = [
    `<dc:identifier id="pub-id">${escapeXml(pubId)}</dc:identifier>`,
    `<dc:title>${escapeXml(publication.title)}</dc:title>`,
    `<dc:language>${escapeXml(publication.language || 'en')}</dc:language>`,
    `<dc:creator>${escapeXml(publication.authorName || 'Anonymous')}</dc:creator>`,
    `<meta property="dcterms:modified">${escapeXml(modifiedAt)}</meta>`,
    publication.description
      ? `<dc:description>${escapeXml(publication.description)}</dc:description>`
      : null,
    publication.rights ? `<dc:rights>${escapeXml(publication.rights)}</dc:rights>` : null,
  ]
    .filter(Boolean)
    .join('\n    ');

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadataXml}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`;

  const navLinks = sortedChapters
    .map(
      (ch) =>
        `        <li><a href="chapters/${escapeXml(ch.id)}.xhtml">${escapeXml(ch.title)}</a></li>`,
    )
    .join('\n');

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(publication.language || 'en')}">
  <head>
    <title>${escapeXml(publication.title)}</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" href="style.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc" role="doc-toc" aria-label="Table of Contents">
      <h1>Table of Contents</h1>
      <ol>
${navLinks}
      </ol>
    </nav>
  </body>
</html>`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const entries: ZipEntry[] = [
    {
      name: 'mimetype',
      data: Buffer.from('application/epub+zip', 'ascii'),
      store: true,
    },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml, 'utf8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(contentOpf, 'utf8'),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml, 'utf8'),
    },
    {
      name: 'OEBPS/style.css',
      data: Buffer.from(DEFAULT_STYLE_CSS, 'utf8'),
    },
  ];

  sortedChapters.forEach((chapter) => {
    const chapterXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(publication.language || 'en')}">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" href="../style.css"/>
  </head>
  <body>
    <section epub:type="chapter" role="doc-chapter">
      <h1 id="chapter-title">${escapeXml(chapter.title)}</h1>
      ${sanitizeChapterXhtml(chapter.contentHtml)}
    </section>
  </body>
</html>`;

    entries.push({
      name: `OEBPS/chapters/${chapter.id}.xhtml`,
      data: Buffer.from(chapterXml, 'utf8'),
    });
  });

  assets.forEach((asset) => {
    entries.push({
      name: `OEBPS/assets/${asset.name}`,
      data: Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data),
    });
  });

  return buildZip(entries);
}
