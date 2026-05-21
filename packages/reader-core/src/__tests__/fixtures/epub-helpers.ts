/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixture helpers */
import { Buffer } from 'node:buffer';
import { deflateRaw, inflateRawSync } from 'node:zlib';
import { promisify } from 'node:util';

const deflateRawAsync = promisify(deflateRaw);

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryData {
  name: string;
  data: Buffer;
  store?: boolean;
}

export async function createZip(entries: ZipEntryData[]): Promise<Buffer> {
  const localSegments: Buffer[] = [];
  const centralSegments: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const data = entry.data;
    const crc = crc32(data);
    const fnLen = nameBuf.length;

    let compressed: Buffer;
    let method: number;
    if (entry.store) {
      compressed = data;
      method = 0;
    } else {
      compressed = await deflateRawAsync(data);
      method = 8;
    }

    const compLen = compressed.length;
    const uncompLen = data.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compLen, 18);
    lfh.writeUInt32LE(uncompLen, 22);
    lfh.writeUInt16LE(fnLen, 26);
    lfh.writeUInt16LE(0, 28);

    localSegments.push(lfh, nameBuf, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compLen, 20);
    cd.writeUInt32LE(uncompLen, 24);
    cd.writeUInt16LE(fnLen, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    centralSegments.push(cd, nameBuf);

    offset += 30 + fnLen + compLen;
  }

  const centralOffset = offset;
  const centralBuf = Buffer.concat(centralSegments);
  const centralSize = centralBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localSegments, centralBuf, eocd]);
}

export function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  let eocdPos = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b &&
        buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const numEntries = buf.readUInt16LE(eocdPos + 10);

  let cdPos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(cdPos) !== CENTRAL_DIR_HEADER_SIG) break;

    const _compMethod = buf.readUInt16LE(cdPos + 10);
    const _compSize = buf.readUInt32LE(cdPos + 20);
    const _uncompSize = buf.readUInt32LE(cdPos + 24);
    const fnLen = buf.readUInt16LE(cdPos + 28);
    const extLen = buf.readUInt16LE(cdPos + 30);
    const localOffset = buf.readUInt32LE(cdPos + 42);

    const fn = buf.subarray(cdPos + 46, cdPos + 46 + fnLen).toString('utf-8');

    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtLen;
    const localCompSize = buf.readUInt32LE(localOffset + 18);
    const localCompMethod = buf.readUInt16LE(localOffset + 8);

    const dataSlice = buf.subarray(dataStart, dataStart + localCompSize);

    if (localCompMethod === 0) {
      entries.set(fn, dataSlice);
    } else if (localCompMethod === 8) {
      entries.set(fn, inflateRawSync(dataSlice));
    } else {
      entries.set(fn, dataSlice);
    }

    cdPos += 46 + fnLen + extLen;
  }

  return entries;
}

// ---- EPUB Content Templates ----

export const MIMETYPE = 'application/epub+zip';

export function containerXml(opfPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function contentOpf(opts: {
  title: string;
  author?: string;
  language?: string;
  identifier?: string;
  cover?: string;
  manifest: Array<{ id: string; href: string; mediaType: string }>;
  spine: Array<{ idref: string; properties?: string }>;
}): string {
  const metadata = [
    `<dc:title>${escapeXml(opts.title)}</dc:title>`,
    opts.author ? `<dc:creator>${escapeXml(opts.author)}</dc:creator>` : '',
    opts.language ? `<dc:language>${escapeXml(opts.language)}</dc:language>` : '',
    opts.identifier ? `<dc:identifier>${escapeXml(opts.identifier)}</dc:identifier>` : '',
  ].filter(Boolean).join('\n    ');

  const manifest = opts.manifest.map((item) =>
    `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"/>`
  ).join('\n');

  const spine = opts.spine.map((item) =>
    `    <itemref idref="${escapeXml(item.idref)}"${item.properties ? ` properties="${escapeXml(item.properties)}"` : ''}/>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadata}
  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

export function navXhtml(items: Array<{ label: string; href: string }>): string {
  const links = items.map((item) =>
    `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a></li>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${links}
    </ol>
  </nav>
</body>
</html>`;
}

export function sectionXhtml(id: string, content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(id)}</title></head>
<body>
  <section id="${escapeXml(id)}">
    ${content}
  </section>
</body>
</html>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ---- EPUB Parsing Helpers ----

export function extractXmlString(xml: string, tag: string, ns?: string): string | null {
  const nsPrefix = ns ? `[a-z0-9]+:${tag}` : tag;
  const _nsAttr = ns ? ` xmlns:[a-z0-9]+="${escapeXml(ns)}"` : '';
  const regex = new RegExp(`<${nsPrefix}(?:[^>]*)?>([^<]*)</${nsPrefix}>`, 'i');
  const match = regex.exec(xml);
  return match?.[1]?.trim() ?? null;
}

export function extractXmlAttributes(xml: string, tag: string, attrName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}([^>]*)>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const attrRegex = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
    const attrMatch = attrRegex.exec(match[1]!);
    if (attrMatch) {
      results.push(attrMatch[1]!);
    }
  }
  return results;
}

export function generateSpineCfi(spineIndex: number): string {
  return `epubcfi(/6/${spineIndex + 2})`;
}
