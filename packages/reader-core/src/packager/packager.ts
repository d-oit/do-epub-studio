import type { AuthorPublication } from '@do-epub-studio/shared';
import { parseAuthorContent } from '../author-content';
import { sanitizeAuthorStylesheet } from '../author-styles';
import { buildZip, type ZipEntry } from './zip';
import { escapeXml, sanitizeChapterXhtml } from './serializer';

export interface PackagedAsset {
  id: string;
  data: Uint8Array;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'text/css';
}

export interface PackagerOptions {
  identifier: string;
  modifiedAt: string;
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

const ASSET_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'text/css': 'css',
} as const;

const textEncoder = new TextEncoder();
const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true });
const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assetName(asset: PackagedAsset): string {
  if (!assetIdPattern.test(asset.id)) throw new TypeError('Invalid author asset ID');
  return `${asset.id}.${ASSET_EXTENSIONS[asset.mediaType]}`;
}

function collectImageAssetIds(publication: AuthorPublication): Set<string> {
  const referenced = new Set<string>();
  for (const chapter of publication.chapters) {
    const pending = [...parseAuthorContent(chapter.contentHtml)];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node || node.type !== 'element') continue;
      if (node.tag === 'img') {
        const source = node.attributes.find((attribute) => attribute.name === 'src')?.value;
        if (source?.startsWith('asset:')) referenced.add(source.slice('asset:'.length));
      }
      for (const child of node.children) pending.push(child);
    }
  }
  return referenced;
}

function normalizeModifiedAt(value: string): string {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError('Invalid EPUB modified timestamp');
  return timestamp.toISOString().replace('.000Z', 'Z');
}

function createPackageEntries(
  publication: AuthorPublication,
  packageAssets: readonly PackagedAsset[],
  options: PackagerOptions,
): ZipEntry[] {
  const modifiedAt = normalizeModifiedAt(options.modifiedAt);
  if (!options.identifier.trim()) throw new TypeError('EPUB identifier must not be empty');
  const publicationId = publication.identifier?.trim() || options.identifier.trim();
  const sortedChapters = [...publication.chapters].sort((a, b) => a.order - b.order);
  const assetsById = new Map<string, PackagedAsset>();
  for (const asset of packageAssets) {
    if (assetsById.has(asset.id)) throw new TypeError(`Duplicate author asset ID: ${asset.id}`);
    assetName(asset);
    assetsById.set(asset.id, asset);
  }

  const imageAssetIds = collectImageAssetIds(publication);
  const usedAssetIds = new Set(imageAssetIds);
  if (publication.coverImageAssetId) usedAssetIds.add(publication.coverImageAssetId);
  for (const stylesheetId of publication.stylesheetAssetIds) usedAssetIds.add(stylesheetId);

  const resolvedAssets = new Map<string, PackagedAsset>();
  for (const id of usedAssetIds) {
    const asset = assetsById.get(id);
    if (!asset) throw new TypeError(`Missing author asset: ${id}`);
    resolvedAssets.set(id, asset);
  }
  for (const id of imageAssetIds) {
    if (resolvedAssets.get(id)?.mediaType === 'text/css') {
      throw new TypeError(`Image reference does not target an image asset: ${id}`);
    }
  }
  if (
    publication.coverImageAssetId &&
    resolvedAssets.get(publication.coverImageAssetId)?.mediaType === 'text/css'
  ) {
    throw new TypeError('Cover image must reference an image asset');
  }
  for (const id of publication.stylesheetAssetIds) {
    if (resolvedAssets.get(id)?.mediaType !== 'text/css') {
      throw new TypeError(`Stylesheet reference does not target CSS: ${id}`);
    }
  }

  const assetPaths = new Map(
    [...resolvedAssets].map(([id, asset]) => [id, assetName(asset)] as const),
  );
  const stylesheets = publication.stylesheetAssetIds.map((id) => {
    const asset = resolvedAssets.get(id);
    if (!asset) throw new TypeError(`Missing stylesheet asset: ${id}`);
    const source = fatalUtf8Decoder.decode(asset.data);
    return {
      id,
      name: assetName(asset),
      data: textEncoder.encode(sanitizeAuthorStylesheet(source)),
    };
  });
  const orderedAssets = [...resolvedAssets.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="default-style" href="styles/default.css" media-type="text/css"/>',
    ...sortedChapters.map(
      (chapter, index) =>
        `<item id="ch-${index + 1}" href="chapters/${escapeXml(chapter.id)}.xhtml" media-type="application/xhtml+xml"/>`,
    ),
    ...stylesheets.map(
      (stylesheet) =>
        `<item id="stylesheet-${escapeXml(stylesheet.id)}" href="styles/${escapeXml(stylesheet.name)}" media-type="text/css"/>`,
    ),
    ...orderedAssets
      .filter((asset) => asset.mediaType !== 'text/css')
      .map((asset) => {
        const isCover = asset.id === publication.coverImageAssetId;
        const id = `asset-${asset.id}`;
        const path = `assets/${assetName(asset)}`;
        const properties = isCover ? ' properties="cover-image"' : '';
        return `<item id="${escapeXml(id)}" href="${escapeXml(path)}" media-type="${escapeXml(asset.mediaType)}"${properties}/>`;
      }),
  ];
  const spineItems = sortedChapters.map((_, index) => `<itemref idref="ch-${index + 1}"/>`);

  const metadataXml = [
    `<dc:identifier id="pub-id">${escapeXml(publicationId)}</dc:identifier>`,
    `<dc:title>${escapeXml(publication.title)}</dc:title>`,
    `<dc:language>${escapeXml(publication.language || 'en')}</dc:language>`,
    ...publication.creators.map((creator) => `<dc:creator>${escapeXml(creator)}</dc:creator>`),
    publication.publisher
      ? `<dc:publisher>${escapeXml(publication.publisher)}</dc:publisher>`
      : null,
    `<meta property="dcterms:modified">${escapeXml(modifiedAt)}</meta>`,
    publication.description
      ? `<dc:description>${escapeXml(publication.description)}</dc:description>`
      : null,
    publication.rights ? `<dc:rights>${escapeXml(publication.rights)}</dc:rights>` : null,
  ]
    .filter((value): value is string => value !== null)
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
      (chapter) =>
        `        <li><a href="chapters/${escapeXml(chapter.id)}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    )
    .join('\n');
  const stylesheetLinks = [
    '        <link rel="stylesheet" type="text/css" href="styles/default.css"/>',
    ...stylesheets.map(
      (stylesheet) =>
        `        <link rel="stylesheet" type="text/css" href="styles/${escapeXml(stylesheet.name)}"/>`,
    ),
  ].join('\n');

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(publication.language || 'en')}">
  <head>
    <title>${escapeXml(publication.title)}</title>
    <meta charset="utf-8"/>
${stylesheetLinks}
  </head>
  <body>
    <nav epub:type="toc" id="toc" role="doc-toc" title="Table of Contents">
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
    { name: 'mimetype', data: textEncoder.encode('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: textEncoder.encode(containerXml) },
    { name: 'OEBPS/content.opf', data: textEncoder.encode(contentOpf) },
    { name: 'OEBPS/nav.xhtml', data: textEncoder.encode(navXhtml) },
    { name: 'OEBPS/styles/default.css', data: textEncoder.encode(DEFAULT_STYLE_CSS) },
    ...stylesheets.map((stylesheet) => ({
      name: `OEBPS/styles/${stylesheet.name}`,
      data: stylesheet.data,
    })),
  ];

  for (const chapter of sortedChapters) {
    const chapterXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(publication.language || 'en')}">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" type="text/css" href="../styles/default.css"/>
${stylesheets
  .map(
    (stylesheet) =>
      `    <link rel="stylesheet" type="text/css" href="../styles/${escapeXml(stylesheet.name)}"/>`,
  )
  .join('\n')}
  </head>
  <body>
    <section epub:type="chapter" role="doc-chapter">
      <h1 id="chapter-title">${escapeXml(chapter.title)}</h1>
      ${sanitizeChapterXhtml(chapter.contentHtml, assetPaths)}
    </section>
  </body>
</html>`;
    entries.push({
      name: `OEBPS/chapters/${chapter.id}.xhtml`,
      data: textEncoder.encode(chapterXml),
    });
  }

  for (const asset of orderedAssets) {
    if (asset.mediaType === 'text/css') continue;
    entries.push({
      name: `OEBPS/assets/${assetName(asset)}`,
      data: asset.data,
    });
  }

  return entries;
}

/** Packages one saved publication snapshot and its referenced local assets. */
export async function packageEpub3(
  publication: AuthorPublication,
  assets: readonly PackagedAsset[],
  options: PackagerOptions,
): Promise<Uint8Array> {
  return buildZip(createPackageEntries(publication, assets, options));
}
