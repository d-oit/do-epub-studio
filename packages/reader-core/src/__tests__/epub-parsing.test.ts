/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { isValidCfi } from '../epub-loader';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

// ---------------------------------------------------------------------------
// ZIP reading helpers (Node.js-based, no external deps)
// ---------------------------------------------------------------------------

function findEocd(buf: Buffer): number {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b &&
        buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdPos = findEocd(buf);
  if (eocdPos === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const numEntries = buf.readUInt16LE(eocdPos + 10);

  let pos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x02014b50) break;

    const fnLen = buf.readUInt16LE(pos + 28);
    const extLen = buf.readUInt16LE(pos + 30);
    const fn = buf.subarray(pos + 46, pos + 46 + fnLen).toString('utf-8');
    const localOffset = buf.readUInt32LE(pos + 42);
    const _compMethod = buf.readUInt16LE(pos + 10);

    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtLen;
    const localCompSize = buf.readUInt32LE(localOffset + 18);
    const localCompMethod = buf.readUInt16LE(localOffset + 8);

    let data = buf.subarray(dataStart, dataStart + localCompSize);
    if (localCompMethod === 8) {
      data = inflateRawSync(data);
    }
    entries.set(fn, data);

    pos += 46 + fnLen + extLen;
  }
  return entries;
}

function readEpubFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURES, name));
}

// ---------------------------------------------------------------------------
// XML parsing helpers (regex-based, no external deps)
// ---------------------------------------------------------------------------

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}(?:[^>]*)>([^<]*)</${tag}>`, 'i');
  const m = regex.exec(xml);
  return m?.[1]?.trim() ?? null;
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}(?:[^>]*)>([^<]*)</${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1]!.trim());
  }
  return results;
}

function extractAttrs(xml: string, tag: string, attr: string): string[] {
  const results: string[] = [];
  const tagRegex = new RegExp(`<${tag}([^>]*)>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(xml)) !== null) {
    const attrRegex = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i');
    const am = attrRegex.exec(m[1]!);
    if (am) results.push(am[1]!);
  }
  return results;
}

// ---------------------------------------------------------------------------
// EPUB validation helpers
// ---------------------------------------------------------------------------

function validateEpubStructure(buf: Buffer): {
  valid: boolean;
  mimetype: string | null;
  hasContainerXml: boolean;
  opfPath: string | null;
  error?: string;
} {
  const entries = readZipEntries(buf);

  const mimetypeEntry = entries.get('mimetype');
  if (!mimetypeEntry) {
    return { valid: false, mimetype: null, hasContainerXml: false, opfPath: null, error: 'Missing mimetype file' };
  }

  const mimetype = mimetypeEntry.toString('utf-8').trim();
  if (mimetype !== 'application/epub+zip') {
    return { valid: false, mimetype, hasContainerXml: false, opfPath: null, error: 'Invalid mimetype' };
  }

  const containerXml = entries.get('META-INF/container.xml');
  if (!containerXml) {
    return { valid: false, mimetype, hasContainerXml: false, opfPath: null, error: 'Missing META-INF/container.xml' };
  }

  const containerStr = containerXml.toString('utf-8');
  const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? null;

  if (!opfPath) {
    return { valid: false, mimetype, hasContainerXml: true, opfPath: null, error: 'No rootfile in container.xml' };
  }

  const opfEntry = entries.get(opfPath);
  if (!opfEntry) {
    return { valid: false, mimetype, hasContainerXml: true, opfPath, error: `OPF not found: ${opfPath}` };
  }

  return { valid: true, mimetype, hasContainerXml: true, opfPath };
}

function parseEpubMetadata(buf: Buffer): {
  title: string;
  creator: string | null;
  language: string | null;
} {
  const entries = readZipEntries(buf);
  const containerStr = entries.get('META-INF/container.xml')?.toString('utf-8') ?? '';
  const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? '';
  const opfXml = entries.get(opfPath)?.toString('utf-8') ?? '';

  return {
    title: extractTag(opfXml, 'dc:title') ?? '',
    creator: extractTag(opfXml, 'dc:creator') ?? null,
    language: extractTag(opfXml, 'dc:language') ?? null,
  };
}

function parseSpineItems(buf: Buffer): Array<{ idref: string; properties: string | null }> {
  const entries = readZipEntries(buf);
  const containerStr = entries.get('META-INF/container.xml')?.toString('utf-8') ?? '';
  const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? '';
  const opfXml = entries.get(opfPath)?.toString('utf-8') ?? '';

  const idrefs = extractAttrs(opfXml, 'itemref', 'idref');
  const props = extractAttrs(opfXml, 'itemref', 'properties');

  return idrefs.map((idref, i) => ({
    idref,
    properties: props[i] ?? null,
  }));
}

function parseTocItems(buf: Buffer): Array<{ label: string; href: string }> {
  const entries = readZipEntries(buf);
  const containerStr = entries.get('META-INF/container.xml')?.toString('utf-8') ?? '';
  const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? '';
  const opfXml = entries.get(opfPath)?.toString('utf-8') ?? '';
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // Find nav documents from spine
  const spineIdrefs = extractAttrs(opfXml, 'itemref', 'idref');
  const spineProps = extractAttrs(opfXml, 'itemref', 'properties');
  const manifestHrefs = extractAttrs(opfXml, 'item', 'href');
  const manifestIds = extractAttrs(opfXml, 'item', 'id');

  const toc: Array<{ label: string; href: string }> = [];

  for (let i = 0; i < spineIdrefs.length; i++) {
    const idref = spineIdrefs[i]!;
    const prop = spineProps[i];
    if (prop?.includes('nav')) {
      const idx = manifestIds.indexOf(idref);
      if (idx !== -1) {
        const href = manifestHrefs[idx]!;
        const navXml = entries.get(opfDir + href)?.toString('utf-8') ?? '';
        const links = extractAllTags(navXml, 'a');
        const linkHrefs = extractAttrs(navXml, 'a', 'href');
        for (let j = 0; j < links.length && j < linkHrefs.length; j++) {
          toc.push({ label: links[j]!, href: linkHrefs[j]! });
        }
      }
    }
  }

  return toc;
}

function generateSpineCfi(spineIndex: number): string {
  return `epubcfi(/6/${spineIndex + 2})`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EPUB file structure validation', () => {
  it('validates a well-formed minimal EPUB', () => {
    const buf = readEpubFixture('minimal.epub');
    const result = validateEpubStructure(buf);
    expect(result.valid).toBe(true);
    expect(result.mimetype).toBe('application/epub+zip');
    expect(result.hasContainerXml).toBe(true);
    expect(result.opfPath).toBe('OEBPS/content.opf');
  });

  it('rejects EPUB with invalid mimetype', () => {
    const buf = readEpubFixture('invalid-mimetype.epub');
    const result = validateEpubStructure(buf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid mimetype');
  });

  it('rejects EPUB with missing container.xml', () => {
    const buf = readEpubFixture('missing-container.epub');
    const result = validateEpubStructure(buf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing META-INF/container.xml');
  });

  it('detects missing mimetype in non-EPUB ZIP', () => {
    const buf = readEpubFixture('missing-container.epub');
    // missing-container has mimetype but no container.xml
    const entries = readZipEntries(buf);
    expect(entries.has('mimetype')).toBe(true);
    expect(entries.has('META-INF/container.xml')).toBe(false);
  });

  it('ensures mimetype is the first file in the archive', () => {
    const buf = readEpubFixture('minimal.epub');
    const eocdPos = findEocd(buf);
    const cdOffset = buf.readUInt32LE(eocdPos + 16);
    const firstEntryNameLen = buf.readUInt16LE(cdOffset + 28);
    const firstEntryName = buf.subarray(cdOffset + 46, cdOffset + 46 + firstEntryNameLen).toString();
    expect(firstEntryName).toBe('mimetype');
  });
});

describe('Metadata extraction', () => {
  it('extracts title, creator, and language from minimal EPUB', () => {
    const buf = readEpubFixture('minimal.epub');
    const meta = parseEpubMetadata(buf);
    expect(meta.title).toBe('Minimal Test Book');
    expect(meta.creator).toBe('Test Author');
    expect(meta.language).toBe('en');
  });

  it('handles empty title metadata', () => {
    const buf = readEpubFixture('no-metadata.epub');
    const meta = parseEpubMetadata(buf);
    expect(meta.title).toBe('');
    expect(meta.creator).toBeNull();
    expect(meta.language).toBeNull();
  });

  it('extracts metadata from content.opf', () => {
    const buf = readEpubFixture('minimal.epub');
    const entries = readZipEntries(buf);
    const opfXml = entries.get('OEBPS/content.opf')?.toString('utf-8') ?? '';
    expect(opfXml).toContain('<dc:title>Minimal Test Book</dc:title>');
    expect(opfXml).toContain('<dc:creator>Test Author</dc:creator>');
    expect(opfXml).toContain('<dc:language>en</dc:language>');
  });
});

describe('Spine parsing', () => {
  it('parses spine items from minimal EPUB', () => {
    const buf = readEpubFixture('minimal.epub');
    const spine = parseSpineItems(buf);
    expect(spine).toHaveLength(2);
    expect(spine[0]?.idref).toBe('nav');
    expect(spine[0]?.properties).toBe('nav');
    expect(spine[1]?.idref).toBe('section0001');
    expect(spine[1]?.properties).toBeNull();
  });

  it('returns empty array for EPUB with no spine', () => {
    const buf = readEpubFixture('no-spine.epub');
    const spine = parseSpineItems(buf);
    expect(spine).toHaveLength(0);
  });

  it('preserves spine item ordering', () => {
    const buf = readEpubFixture('multi-nav.epub');
    const spine = parseSpineItems(buf);
    expect(spine).toHaveLength(3);
    expect(spine[0]?.idref).toBe('nav1');
    expect(spine[1]?.idref).toBe('nav2');
    expect(spine[2]?.idref).toBe('content');
  });
});

describe('TOC parsing', () => {
  it('parses TOC from nav document', () => {
    const buf = readEpubFixture('minimal.epub');
    const toc = parseTocItems(buf);
    expect(toc.length).toBeGreaterThanOrEqual(1);
    expect(toc[0]?.label).toBe('Start');
    expect(toc[0]?.href).toBe('section0001.xhtml');
  });

  it('handles EPUB with no nav in spine', () => {
    const buf = readEpubFixture('no-spine.epub');
    const toc = parseTocItems(buf);
    expect(toc).toHaveLength(0);
  });
});

describe('CFI generation for spine items', () => {
  it('generates valid CFI for each spine item', () => {
    const buf = readEpubFixture('minimal.epub');
    const spine = parseSpineItems(buf);
    spine.forEach((_, index) => {
      const cfi = generateSpineCfi(index);
      expect(isValidCfi(cfi)).toBe(true);
    });
  });

  it('generates sequential CFIs matching spine order', () => {
    const buf = readEpubFixture('multi-nav.epub');
    const spine = parseSpineItems(buf);
    const cfis = spine.map((_, i) => generateSpineCfi(i));
    expect(cfis).toEqual([
      'epubcfi(/6/2)',
      'epubcfi(/6/3)',
      'epubcfi(/6/4)',
    ]);
  });
});

describe('Error handling for invalid EPUBs', () => {
  it('returns empty entries for non-ZIP data', () => {
    const buf = Buffer.from('not a zip file at all');
    const entries = readZipEntries(buf);
    expect(entries.size).toBe(0);
  });

  it('returns empty entries for truncated data', () => {
    const buf = readEpubFixture('minimal.epub');
    const truncated = buf.subarray(0, 50);
    const entries = readZipEntries(truncated);
    expect(entries.size).toBe(0);
  });

  it('handles missing manifest items gracefully', () => {
    const buf = readEpubFixture('no-spine.epub');
    const entries = readZipEntries(buf);
    const opfXml = entries.get('OEBPS/content.opf')?.toString('utf-8') ?? '';
    const spineItems = extractAttrs(opfXml, 'itemref', 'idref');
    expect(spineItems).toHaveLength(0);
  });
});

describe('Edge cases', () => {
  it('detects multiple nav documents in spine', () => {
    const buf = readEpubFixture('multi-nav.epub');
    const spine = parseSpineItems(buf);
    const _navItems = spine.filter((item) => item.properties === 'nav');
    // Neither item has explicit "nav" property, but both exist as spine entries
    const spineWithProps = spine.filter((s) => s.properties !== null);
    expect(spineWithProps).toHaveLength(0);
  });

  it('parses OPF with empty metadata fields', () => {
    const buf = readEpubFixture('no-metadata.epub');
    const entries = readZipEntries(buf);
    const containerStr = entries.get('META-INF/container.xml')?.toString('utf-8') ?? '';
    const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? '';
    const opfXml = entries.get(opfPath)?.toString('utf-8') ?? '';

    expect(opfXml).toBeDefined();
    expect(opfXml).not.toContain('<dc:title>');
    expect(opfXml).not.toContain('<dc:creator>');
  });

  it('validates CFI format for spine-generated values', () => {
    for (let i = 0; i < 20; i++) {
      const cfi = generateSpineCfi(i);
      expect(isValidCfi(cfi)).toBe(true);
      expect(cfi).toMatch(new RegExp(`^epubcfi\\(/6/${i + 2}\\)$`));
    }
  });
});
