/**
 * Deterministic EPUB scaffolding builders for the #1483 corpus (XHTML,
 * container/OPF/NCX/nav documents, and the archive assembler). Per-fixture
 * generators live in ./entries; synthesized resources live in ./resources.
 */
import { buildZip, type ZipEntry } from './zip';
import { prng } from './resources';

export interface Chapter {
  href: string;
  title: string;
  body: string;
}

export interface ExtraItem {
  /** Manifest item id. */
  id: string;
  /** Archive path under OEBPS/. */
  href: string;
  mediaType: string;
  data: Uint8Array;
  method?: 0 | 8;
  /** Include in the OPF manifest (default true). */
  includeInManifest?: boolean;
}

export interface EpubSpec {
  version: '2.0' | '3.0';
  title: string;
  language: string;
  uniqueId?: string;
  direction?: 'ltr' | 'rtl';
  chapters: Chapter[];
  /** Additional `metadata` inner XML (e.g. accessibility meta lines). */
  metadataExtras?: string[];
  /** Extra files (images, fonts, audio, nav docs, …). */
  items?: ExtraItem[];
  /** OPF spine property strings keyed by manifest item id. */
  spineProperties?: Record<string, string>;
  /** render rootfiles; defaults to a single OEBPS/content.opf. */
  rootfiles?: Array<{ fullPath: string; mediaType: string }>;
  /** META-INF/encryption.xml content (encrypted-resources fixture). */
  encryptionXml?: string | null;
  /** Extra arbitrary archive files (nav docs, smil, …). */
  extraFiles?: ZipEntry[];
  /** Whether to include toc.ncx (EPUB 2 style). */
  includeNcx?: boolean;
  /** Whether to include nav.xhtml with epub:type=toc (EPUB 3). */
  includeNavDoc?: boolean;
  /** OPF media-type for the ncx item. */
  ncxMediaType?: string;
  /** Extra OPF manifest lines (string) — raw injection. */
  manifestExtras?: string[];
  /** Extra OPF spine lines — raw injection. */
  spineExtras?: string[];
}

const XHTML_PREFIX =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n';

export function xhtmlDoc(body: string, headExtras = ''): string {
  return `${XHTML_PREFIX}<head>${headExtras}</head>\n<body>\n${body}\n</body>\n</html>`;
}

export const CONTAINER_NAMESPACE = 'urn:oasis:names:tc:opendocument:xmlns:container';

export function containerXml(rootfiles: Array<{ fullPath: string; mediaType: string }>): string {
  const rfs = rootfiles
    .map((r) => `    <rootfile full-path="${r.fullPath}" media-type="${r.mediaType}"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="${CONTAINER_NAMESPACE}">\n  <rootfiles>\n${rfs}\n  </rootfiles>\n</container>`;
}

export function opfXml(spec: EpubSpec, _opfPath: string): string {
  const uniqueId = spec.uniqueId ?? 'uid';
  const identifierValue = spec.uniqueId
    ? `urn:uuid:00000000-0000-0000-0000-${spec.uniqueId}`
    : 'urn:uuid:00000000-0000-0000-0000-000000000000';
  const items = spec.chapters
    .map(
      (ch, i) => `    <item id="ch${i + 1}" href="${ch.href}" media-type="application/xhtml+xml"/>`,
    )
    .join('\n');
  const autoItems: string[] = [];
  if (spec.includeNavDoc) {
    autoItems.push(
      '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    );
  }
  if (spec.includeNcx) {
    autoItems.push('    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  }
  const itemLines = [
    items,
    ...autoItems,
    ...(spec.items ?? [])
      .filter((it) => it.includeInManifest !== false)
      .map((it) => `    <item id="${it.id}" href="${it.href}" media-type="${it.mediaType}"/>`),
    ...(spec.manifestExtras ?? []),
  ].join('\n');
  const spine = spec.chapters
    .map((_ch, i) => {
      const props = spec.spineProperties?.[`ch${i + 1}`];
      return `    <itemref idref="ch${i + 1}"${props ? ` properties="${props}"` : ''}/>`;
    })
    .join('\n');
  const metadata = [
    `    <dc:identifier id="${uniqueId}">${identifierValue}</dc:identifier>`,
    `    <dc:title>${spec.title}</dc:title>`,
    `    <dc:language>${spec.language}</dc:language>`,
    ...(spec.metadataExtras ?? []),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="${spec.version}" unique-identifier="${uniqueId}"${spec.direction ? ` dir="${spec.direction}"` : ''}>\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n${metadata}\n  </metadata>\n  <manifest>\n${itemLines}\n  </manifest>\n  <spine${spec.includeNcx ? ' toc="ncx"' : ''}>\n${spine}\n${spec.spineExtras?.join('\n') ?? ''}\n  </spine>\n</package>`;
}

export function ncxXml(spec: EpubSpec): string {
  const navPoints = spec.chapters
    .map(
      (ch, i) =>
        `  <navPoint id="nav${i + 1}" playOrder="${i + 1}">\n    <navLabel><text>${ch.title}</text></navLabel>\n    <content src="${ch.href}"/>\n  </navPoint>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n  <head><meta name="dtb:uid" content="urn:uuid:00000000-0000-0000-0000-000000000000"/></head>\n  <docTitle><text>${spec.title}</text></docTitle>\n  <navMap>\n${navPoints}\n  </navMap>\n</ncx>`;
}

export function navDocXml(spec: EpubSpec): string {
  const links = spec.chapters
    .map((ch) => `      <li><a href="${ch.href}">${ch.title}</a></li>`)
    .join('\n');
  return xhtmlDoc(
    `<nav epub:type="toc"><h1>Table of Contents</h1><ol>\n${links}\n    </ol></nav>`,
    '<title>Navigation</title>',
  );
}

/** Assemble a complete EPUB archive from a spec. Deterministic file order. */
export function buildEpubFromSpec(spec: EpubSpec): Uint8Array {
  const rootfiles = spec.rootfiles?.length
    ? spec.rootfiles
    : [{ fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' }];

  const files: ZipEntry[] = [
    { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
    { name: 'META-INF/container.xml', data: new TextEncoder().encode(containerXml(rootfiles)) },
  ];

  if (spec.encryptionXml !== undefined && spec.encryptionXml !== null) {
    files.push({
      name: 'META-INF/encryption.xml',
      data: new TextEncoder().encode(spec.encryptionXml),
    });
  }

  const emittedPaths = new Set(files.map((file) => file.name));
  const addFile = (file: ZipEntry): void => {
    if (emittedPaths.has(file.name)) return;
    emittedPaths.add(file.name);
    files.push(file);
  };

  rootfiles.forEach((rootfile, index) => {
    const slash = rootfile.fullPath.lastIndexOf('/');
    const rootDirectory = slash >= 0 ? rootfile.fullPath.slice(0, slash + 1) : '';
    const packageSpec: EpubSpec = { ...spec };
    if (index > 0) {
      packageSpec.title = `${spec.title} (alternate)`;
      packageSpec.uniqueId = 'alt';
    }

    addFile({
      name: rootfile.fullPath,
      data: new TextEncoder().encode(opfXml(packageSpec, rootfile.fullPath)),
    });

    if (spec.includeNcx) {
      addFile({
        name: `${rootDirectory}toc.ncx`,
        data: new TextEncoder().encode(ncxXml(packageSpec)),
      });
    }
    if (spec.includeNavDoc) {
      addFile({
        name: `${rootDirectory}nav.xhtml`,
        data: new TextEncoder().encode(navDocXml(packageSpec)),
      });
    }
    for (const chapter of spec.chapters) {
      addFile({
        name: `${rootDirectory}${chapter.href}`,
        data: new TextEncoder().encode(chapter.body),
      });
    }
    for (const item of spec.items ?? []) {
      addFile({
        name: `${rootDirectory}${item.href}`,
        data: item.data,
        method: item.method,
      });
    }
  });

  for (const extra of spec.extraFiles ?? []) {
    files.push(extra);
  }

  return buildZip(files);
}

/**
 * Nonsense but deterministic body for a fixture chapter. Exercises the
 * sanitizer and metadata extraction without relying on any external content.
 */
export function chapterBody(seed: number, paragraphs = 3): string {
  const rng = prng(seed);
  const paras: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    const words = Array.from({ length: 24 }, () => {
      const n = Math.floor(rng() * 12);
      return [
        'the',
        'corpus',
        'of',
        'epub',
        'books',
        'tests',
        'reader',
        'engine',
        'and',
        'a',
        'fixture',
        'specimen',
      ][n];
    }).join(' ');
    // Deterministic pseudo-random tail per paragraph keeps deflate ratios low
    // (the archive validator rejects entries compressing above 10:1), so
    // ordinary fixtures are not spuriously rejected by the ratio guard.
    const noise = Array.from({ length: 40 }, () => {
      const n = Math.floor(rng() * 36);
      return String.fromCharCode(n < 10 ? 48 + n : 97 + n - 10);
    }).join('');
    paras.push(`  <p>${words}. ${noise}</p>`);
  }
  return paras.join('\n');
}
